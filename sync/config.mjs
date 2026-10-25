// Settings screen: `hk-sync.exe --config` serves a small page on 127.0.0.1 and opens it in the browser.
// From there the store can fill in the connections, test them, and start the sync as a Windows task.
// Values are saved to hk-sync.env next to the exe. Connection tests and setup run the agent itself
// (`--check`, `--setup`) as a child process with the entered values.

import { execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { parseEnv } from 'node:util';
import { BASE_DIR, ENV_FILE, PACKAGED } from './env.mjs';

const TASK_NAME = 'Harmony Kitchen Sync';
const FIELDS = [
  'MSSQL_SERVER', 'MSSQL_PORT', 'MSSQL_DATABASE', 'MSSQL_USER', 'MSSQL_PASSWORD',
  'DATABASE_URL', 'SYNC_INTERVAL_MINUTES',
];
const SECRETS = ['MSSQL_PASSWORD', 'DATABASE_URL'];
const DEFAULTS = {
  MSSQL_PORT: '1433', MSSQL_DATABASE: 'db_Harmony', MSSQL_ENCRYPT: 'false', MSSQL_TRUST_CERT: 'true',
  PG_SSL: 'true', PG_SSL_REJECT_UNAUTHORIZED: 'false', TRIAL_ID_START: '900000000',
  SYNC_INTERVAL_MINUTES: '5', FULL_EVERY_MINUTES: '60', RECENT_DAYS: '7',
};

const readSettings = () => ({
  ...DEFAULTS,
  ...(existsSync(ENV_FILE) ? parseEnv(readFileSync(ENV_FILE, 'utf8')) : {}),
});

// Entered values over saved ones; a blank secret keeps the saved value.
function merge(input) {
  const out = readSettings();
  for (const k of FIELDS) {
    const v = String(input[k] ?? '').trim();
    if (v || !SECRETS.includes(k)) out[k] = v;
  }
  return out;
}

function writeSettings(values) {
  const quote = (v) => (/^[\w.:/@-]*$/.test(v) ? v : v.includes('"') ? `'${v}'` : `"${v}"`);
  const lines = ['# Harmony Kitchen Sync settings, written by hk-sync.exe --config'];
  for (const [k, v] of Object.entries(values)) lines.push(`${k}=${quote(String(v))}`);
  writeFileSync(ENV_FILE, `${lines.join('\r\n')}\r\n`);
}

// Runs the agent with one option and the given settings; resolves with its exit code and output.
function runAgent(option, values) {
  const args = PACKAGED ? [option] : [process.argv[1], option];
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { env: { ...process.env, ...values }, cwd: BASE_DIR });
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    child.on('close', (code) => resolve({ ok: code === 0, output: output.trim() }));
  });
}

function registerTask() {
  const ps = (s) => `'${s.replace(/'/g, "''")}'`;
  // when run with Node (development) the task runs `node sync.mjs`
  const args = PACKAGED ? '' : ` -Argument ${ps(`"${process.argv[1]}"`)}`;
  const script = [
    `$a = New-ScheduledTaskAction -Execute ${ps(process.execPath)}${args} -WorkingDirectory ${ps(BASE_DIR)}`,
    '$t = New-ScheduledTaskTrigger -AtStartup',
    '$s = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 ' +
      '-RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew',
    `Register-ScheduledTask -TaskName ${ps(TASK_NAME)} -Action $a -Trigger $t -Settings $s -User 'SYSTEM' -RunLevel Highest -Force | Out-Null`,
    `Stop-ScheduledTask -TaskName ${ps(TASK_NAME)} -ErrorAction SilentlyContinue`,
    `Start-ScheduledTask -TaskName ${ps(TASK_NAME)}`,
  ].join('; ');
  return new Promise((resolve) => {
    execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], (err, stdout, stderr) =>
      resolve({ ok: !err, output: (stderr || stdout || '').trim() }),
    );
  });
}

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (d) => (data += d));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
  });

export async function runConfig() {
  const token = randomBytes(16).toString('hex');
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const send = (status, body, type = 'application/json') => {
      res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(type === 'application/json' ? JSON.stringify(body) : body);
    };
    // the token keeps other local programs and web pages from using this screen
    if (url.searchParams.get('t') !== token && req.headers['x-token'] !== token) return send(403, 'Forbidden', 'text/plain');
    try {
      if (req.method === 'GET' && url.pathname === '/') return send(200, PAGE.replace('__TOKEN__', token), 'text/html');
      if (req.method === 'GET' && url.pathname === '/api/settings') {
        const s = readSettings();
        const view = Object.fromEntries(FIELDS.map((k) => [k, SECRETS.includes(k) ? '' : (s[k] ?? '')]));
        view.saved = Object.fromEntries(SECRETS.map((k) => [k, Boolean(s[k])]));
        return send(200, view);
      }
      if (req.method !== 'POST') return send(404, 'Not found', 'text/plain');
      const values = merge(await readBody(req));
      if (url.pathname === '/api/test') return send(200, await runAgent('--check', values));
      if (url.pathname === '/api/save') {
        writeSettings(values);
        return send(200, { ok: true, output: `Saved to ${ENV_FILE}` });
      }
      if (url.pathname === '/api/start') {
        writeSettings(values);
        const check = await runAgent('--check', values);
        if (!check.ok) return send(200, check);
        const setup = await runAgent('--setup', values);
        if (!setup.ok) return send(200, setup);
        const task = await registerTask();
        if (!task.ok) {
          return send(200, { ok: false, output: `Could not register the Windows task. Run install.bat as administrator.\n${task.output}` });
        }
        return send(200, { ok: true, output: `${check.output}\n\nThe sync is running and starts with Windows.\nLog: ${BASE_DIR}\\hk-sync.log` });
      }
      if (url.pathname === '/api/close') {
        send(200, { ok: true });
        return setTimeout(() => server.close(() => process.exit(0)), 200);
      }
      return send(404, 'Not found', 'text/plain');
    } catch (err) {
      return send(500, { ok: false, output: err.message });
    }
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const link = `http://127.0.0.1:${server.address().port}/?t=${token}`;
  console.log(`Settings screen: ${link}`);
  console.log('Close this window when you are done.');
  execFile('explorer.exe', [link]); // opens the default browser
  await new Promise(() => {}); // runs until the page closes it or the window is closed
}

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Harmony Kitchen Sync</title>
<style>
  :root { --bg:#f6f5f2; --card:#fff; --text:#1f2328; --muted:#636c76; --line:#d8dadd; --accent:#1f6f5c; --bad:#b42318; --good:#1a7f37; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:15px/1.5 system-ui, "Segoe UI", sans-serif; }
  main { max-width:640px; margin:32px auto; padding:0 16px; }
  h1 { font-size:22px; margin:0 0 4px; }
  p.lead { color:var(--muted); margin:0 0 24px; }
  fieldset { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px 20px 8px; margin:0 0 16px; }
  legend { font-weight:600; padding:0 6px; }
  label { display:block; margin:0 0 12px; font-weight:500; }
  label small { display:block; color:var(--muted); font-weight:400; }
  input { width:100%; margin-top:4px; padding:8px 10px; border:1px solid var(--line); border-radius:6px; font:inherit; }
  .row { display:grid; grid-template-columns: 2fr 1fr; gap:12px; }
  .buttons { display:flex; flex-wrap:wrap; gap:8px; margin:8px 0 16px; }
  button { font:inherit; padding:9px 16px; border-radius:6px; border:1px solid var(--line); background:var(--card); cursor:pointer; }
  button.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
  button:disabled { opacity:.5; cursor:wait; }
  .warn { font-size:14px; color:var(--muted); margin:0 0 8px; }
  pre { background:#111; color:#e6e6e6; padding:12px; border-radius:8px; white-space:pre-wrap; font-size:13px; min-height:3em; }
  .ok { color:var(--good); font-weight:600; } .bad { color:var(--bad); font-weight:600; }
</style></head>
<body><main>
<h1>Harmony Kitchen Sync</h1>
<p class="lead">Copies the store's current system into the new app's database every few minutes. It only reads from SQL Server.</p>
<form id="f">
<fieldset><legend>Current system (SQL Server on the ERP PC)</legend>
  <div class="row">
    <label>Server<small>ERP PC name or IP address</small><input name="MSSQL_SERVER" required></label>
    <label>Port<small>&nbsp;</small><input name="MSSQL_PORT" inputmode="numeric"></label>
  </div>
  <label>Database<input name="MSSQL_DATABASE" required></label>
  <label>Login<small>The read-only login created for the sync</small><input name="MSSQL_USER" required autocomplete="off"></label>
  <label>Password<small id="pw-note"></small><input name="MSSQL_PASSWORD" type="password" autocomplete="new-password"></label>
</fieldset>
<fieldset><legend>New app (Supabase)</legend>
  <label>Connection string<small id="url-note">From Supabase: Connect, Session pooler. Starts with postgresql://</small>
    <input name="DATABASE_URL" type="password" autocomplete="off"></label>
  <label>Sync every (minutes)<input name="SYNC_INTERVAL_MINUTES" inputmode="numeric"></label>
</fieldset>
</form>
<div class="buttons">
  <button id="test">Test connections</button>
  <button id="save">Save</button>
  <button id="start" class="primary">Save and start sync</button>
  <button id="close">Close</button>
</div>
<p class="warn">Starting the sync copies everything and replaces what the new app's database holds for the synced tables.</p>
<div id="status"></div>
<pre id="out"></pre>
</main>
<script>
const T = '__TOKEN__';
const f = document.getElementById('f'), out = document.getElementById('out'), status = document.getElementById('status');
const api = (path, body) => fetch(path, { method: body ? 'POST' : 'GET', headers: { 'x-token': T, 'Content-Type': 'application/json' },
  body: body ? JSON.stringify(body) : undefined }).then(r => r.json());
const values = () => Object.fromEntries(new FormData(f));
api('/api/settings').then(s => {
  for (const [k, v] of Object.entries(s)) if (f.elements[k]) f.elements[k].value = v;
  if (s.saved.MSSQL_PASSWORD) document.getElementById('pw-note').textContent = 'Saved. Leave blank to keep it.';
  if (s.saved.DATABASE_URL) document.getElementById('url-note').textContent = 'Saved. Leave blank to keep it.';
});
const buttons = [...document.querySelectorAll('button')];
async function run(path, busy, confirmText) {
  if (confirmText && !confirm(confirmText)) return;
  buttons.forEach(b => b.disabled = true);
  status.textContent = busy; status.className = ''; out.textContent = '';
  try {
    const r = await api(path, values());
    status.textContent = r.ok ? 'Done' : 'Something went wrong';
    status.className = r.ok ? 'ok' : 'bad';
    out.textContent = r.output || '';
  } catch (e) { status.textContent = 'Something went wrong'; status.className = 'bad'; out.textContent = String(e); }
  buttons.forEach(b => b.disabled = false);
}
document.getElementById('test').onclick = () => run('/api/test', 'Testing connections...');
document.getElementById('save').onclick = () => run('/api/save', 'Saving...');
document.getElementById('start').onclick = () => run('/api/start', 'Checking, preparing and starting...',
  'Start the sync now? The first run replaces what the new app holds for the synced tables.');
document.getElementById('close').onclick = () => api('/api/close', {}).finally(() => { document.body.innerHTML = '<main><p>You can close this tab.</p></main>'; });
</script>
</body></html>`;
