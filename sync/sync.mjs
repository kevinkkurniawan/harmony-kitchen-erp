// One-way sync: legacy SQL Server (store) -> Postgres (Supabase, used by the Vercel ERP and POS).
//
//   node --env-file=.env sync.mjs          run forever: a pass every SYNC_INTERVAL_MINUTES,
//                                          comparing every row of every table every FULL_EVERY_MINUTES
//   node --env-file=.env sync.mjs --once   one pass, then exit
//   node --env-file=.env sync.mjs --full   one full pass, then exit
//
// Legacy ModifiedDate is not reliable, so the agent compares row contents: it reads legacy rows, hashes them,
// and writes only rows whose hash differs from what it last wrote (kept in a local cache file). Rows that
// were in legacy last time but are gone now are deleted from Postgres. Large tables (`recent` in tables.mjs)
// are limited to recently created rows between full passes.
//
// Only SELECTs are sent to SQL Server. Rows entered in the new app use ids >= TRIAL_ID_START
// (see setup.mjs); they never appear in the cache, so they are never overwritten or deleted.

import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';
import pg from 'pg';
import { TABLES } from './tables.mjs';

const env = process.env;
const TRIAL_ID_START = Number(env.TRIAL_ID_START ?? 900000000);
const INTERVAL_MIN = Number(env.SYNC_INTERVAL_MINUTES ?? 5);
const FULL_EVERY_MIN = Number(env.FULL_EVERY_MINUTES ?? 60);
const RECENT_DAYS = Number(env.RECENT_DAYS ?? 7);
const CACHE_FILE = env.CACHE_FILE ?? fileURLToPath(new URL('./sync-cache.json', import.meta.url));
const MAX_PARAMS = 60000; // Postgres allows 65535 bind parameters per statement
const LOCK_ID = 727274; // pg advisory lock, keeps two agents from running at once

const log = (...args) => console.log(new Date().toISOString(), ...args);

const legacyPool = new sql.ConnectionPool({
  server: env.MSSQL_SERVER ?? 'localhost',
  port: Number(env.MSSQL_PORT ?? 1433),
  database: env.MSSQL_DATABASE,
  user: env.MSSQL_USER,
  password: env.MSSQL_PASSWORD,
  requestTimeout: 10 * 60 * 1000,
  options: {
    encrypt: env.MSSQL_ENCRYPT === 'true',
    trustServerCertificate: env.MSSQL_TRUST_CERT !== 'false',
    useUTC: false, // legacy datetimes are store-local time; run the agent in the store's time zone
  },
});

const pgPool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.PG_SSL === 'false' ? false : { rejectUnauthorized: env.PG_SSL_REJECT_UNAUTHORIZED === 'true' },
  max: 4,
});

const q = (name) => `"${name}"`;
const b = (name) => `[${name}]`;

// Local wall-clock text for dates, so a legacy `date` key never shifts a day through UTC.
const pad = (n, w = 2) => String(n).padStart(w, '0');
const localText = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
  `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
const norm = (v) =>
  v == null ? null : v instanceof Date ? localText(v) : Buffer.isBuffer(v) ? v.toString('base64') : String(v);

const keyOf = (plan, row) => JSON.stringify(plan.pk.map((c) => norm(row[c])));
const hashOf = (plan, row) =>
  createHash('sha1').update(JSON.stringify(plan.cols.map((c) => norm(row[c])))).digest('base64').slice(0, 16);

// cache: { [table]: { [key]: hash } } of what is in Postgres from legacy
let cache = null;

async function loadCache() {
  try {
    return JSON.parse(await readFile(CACHE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

async function saveCache() {
  const tmp = `${CACHE_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(cache));
  await rename(tmp, CACHE_FILE);
}

// Column lists per table, matched case-insensitively (legacy names are mixed case).
async function loadPlans() {
  const legacy = await legacyPool.request().query(
    `SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo'`,
  );
  const legacyCols = new Map();
  for (const r of legacy.recordset) {
    const t = r.TABLE_NAME.toLowerCase();
    if (!legacyCols.has(t)) legacyCols.set(t, { table: r.TABLE_NAME, cols: new Map() });
    legacyCols.get(t).cols.set(r.COLUMN_NAME.toLowerCase(), r.COLUMN_NAME);
  }

  const target = await pgPool.query(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`,
  );
  const pgCols = new Map();
  for (const r of target.rows) {
    if (!pgCols.has(r.table_name)) pgCols.set(r.table_name, []);
    pgCols.get(r.table_name).push(r.column_name);
  }

  const plans = [];
  for (const t of TABLES) {
    const src = legacyCols.get(t.name);
    const dst = pgCols.get(t.name);
    if (!src || !dst) {
      log(`skip ${t.name}: missing in ${!src ? 'legacy' : 'postgres'}`);
      continue;
    }
    const cols = dst.filter((c) => src.cols.has(c) && !(t.exclude ?? []).includes(c));
    const missingPk = t.pk.filter((c) => !cols.includes(c));
    if (missingPk.length) {
      log(`skip ${t.name}: key column(s) ${missingPk.join(', ')} not in both databases`);
      continue;
    }
    const trialKey = t.trialKey ?? (t.seq ? 'id' : null);
    plans.push({
      ...t,
      legacyTable: src.table,
      cols,
      legacyName: (c) => src.cols.get(c) ?? c,
      recent: t.recent && src.cols.has(t.recent) ? t.recent : null,
      trialKey: trialKey && cols.includes(trialKey) ? trialKey : null,
    });
  }
  return plans;
}

function upsertSql(plan, rowCount) {
  const n = plan.cols.length;
  const values = [];
  for (let i = 0; i < rowCount; i++) {
    values.push(`(${plan.cols.map((_, j) => `$${i * n + j + 1}`).join(',')})`);
  }
  const updates = plan.cols.filter((c) => !plan.pk.includes(c)).map((c) => `${q(c)} = EXCLUDED.${q(c)}`);
  return (
    `INSERT INTO ${q(plan.name)} (${plan.cols.map(q).join(',')}) VALUES ${values.join(',')} ` +
    `ON CONFLICT (${plan.pk.map(q).join(',')}) ` +
    (updates.length ? `DO UPDATE SET ${updates.join(',')}` : 'DO NOTHING')
  );
}

// Writes one batch inside a savepoint. If the batch fails (e.g. a legacy orphan breaks a foreign key),
// retries row by row and records rows that still fail in sync_skipped instead of stopping the table.
// Returns the rows that were written.
async function writeBatch(client, plan, rows) {
  const params = (rs) => rs.flatMap((r) => plan.cols.map((c) => r[c] ?? null));
  await client.query('SAVEPOINT batch');
  try {
    await client.query(upsertSql(plan, rows.length), params(rows));
    await client.query('RELEASE SAVEPOINT batch');
    return rows;
  } catch {
    await client.query('ROLLBACK TO SAVEPOINT batch');
  }
  const written = [];
  for (const row of rows) {
    await client.query('SAVEPOINT row');
    try {
      await client.query(upsertSql(plan, 1), params([row]));
      await client.query('RELEASE SAVEPOINT row');
      written.push(row);
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT row');
      // retried every pass until it goes in; one row per key here, with the latest error
      await client.query(
        `INSERT INTO sync_skipped (table_name, row_key, error) VALUES ($1, $2, $3)
         ON CONFLICT (table_name, row_key) DO UPDATE SET error = EXCLUDED.error, at = now()`,
        [
        plan.name,
        keyOf(plan, row),
          String(err.message).slice(0, 500),
        ],
      );
    }
  }
  if (written.length) {
    await client.query(
      `DELETE FROM sync_skipped WHERE table_name = $1 AND row_key = ANY($2)`,
      [plan.name, written.map((row) => keyOf(plan, row))],
    );
  }
  return written;
}

async function deleteKeys(client, plan, keys) {
  const n = plan.pk.length;
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000).map((k) => JSON.parse(k));
    const tuples = chunk.map((_, k) => `(${plan.pk.map((__, j) => `$${k * n + j + 1}`).join(',')})`);
    await client.query(
      `DELETE FROM ${q(plan.name)} WHERE (${plan.pk.map(q).join(',')}) IN (${tuples.join(',')})`,
      chunk.flat(),
    );
  }
}

// Compares one table and writes the differences, deleting rows that disappeared from legacy.
// Between full passes, large tables only read rows created in the last RECENT_DAYS (no deletes then).
async function syncTable(plan, full) {
  const known = cache[plan.name] ?? {};
  const scoped = !full && plan.recent;
  const select = plan.cols.map((c) => `${b(plan.legacyName(c))} AS ${b(c)}`).join(', ');
  const request = legacyPool.request();
  let where = '';
  if (scoped) {
    request.input('since', sql.DateTime, new Date(Date.now() - RECENT_DAYS * 86400000));
    where = `WHERE ${b(plan.legacyName(plan.recent))} >= @since`;
  }

  const batchSize = Math.min(500, Math.floor(MAX_PARAMS / plan.cols.length));
  const seen = new Set();
  const fresh = {}; // key -> hash for rows written this pass
  let pending = [];
  let changed = 0;
  let skipped = 0;
  let deleted = 0;

  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const flush = async (batch) => {
      const written = await writeBatch(client, plan, batch);
      for (const row of written) fresh[keyOf(plan, row)] = row.__hash;
      changed += written.length;
      skipped += batch.length - written.length;
    };
    await new Promise((resolve, reject) => {
      let chain = Promise.resolve();
      request.stream = true;
      request.on('row', (row) => {
        const key = keyOf(plan, row);
        seen.add(key);
        const hash = hashOf(plan, row);
        if (known[key] === hash) return;
        row.__hash = hash;
        pending.push(row);
        if (pending.length >= batchSize) {
          const batch = pending;
          pending = [];
          request.pause();
          chain = chain
            .then(() => flush(batch))
            .then(() => request.resume())
            .catch(reject);
        }
      });
      request.on('error', reject);
      request.on('done', () => {
        chain.then(() => (pending.length ? flush(pending) : null)).then(resolve, reject);
      });
      request.query(`SELECT ${select} FROM [dbo].${b(plan.legacyTable)} ${where}`);
    });

    // a read that covered the whole table can also tell which rows were deleted in legacy
    const gone = scoped ? [] : Object.keys(known).filter((k) => !seen.has(k));
    if (gone.length) {
      await deleteKeys(client, plan, gone);
      deleted = gone.length;
    }
    await client.query(
      `INSERT INTO sync_state (table_name, last_run, rows_changed, rows_deleted, rows_skipped, last_error)
       VALUES ($1, now(), $2, $3, $4, NULL)
       ON CONFLICT (table_name) DO UPDATE SET last_run = now(), rows_changed = EXCLUDED.rows_changed,
         rows_deleted = EXCLUDED.rows_deleted, rows_skipped = EXCLUDED.rows_skipped, last_error = NULL`,
      [plan.name, changed, deleted, skipped],
    );
    await client.query('COMMIT');
    for (const k of gone) delete known[k];
    Object.assign(known, fresh);
    cache[plan.name] = known;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  if (changed || deleted || skipped) {
    log(`${plan.name}: ${changed} written, ${deleted} deleted${skipped ? `, ${skipped} skipped` : ''}`);
  }
  return seen;
}

// Without a cache the agent cannot know which Postgres rows came from legacy, so after a cold full pass
// it removes rows below the trial range that are not in legacy. Tables without a trialKey are left alone.
async function pruneTable(plan, legacyKeys) {
  if (!plan.trialKey) return;
  const r = await pgPool.query(
    `SELECT ${plan.pk.map(q).join(',')} FROM ${q(plan.name)} WHERE ${q(plan.trialKey)} < $1`,
    [TRIAL_ID_START],
  );
  const gone = r.rows.map((row) => keyOf(plan, row)).filter((k) => !legacyKeys.has(k));
  if (!gone.length) return;
  const client = await pgPool.connect();
  try {
    await deleteKeys(client, plan, gone);
  } finally {
    client.release();
  }
  log(`${plan.name}: ${gone.length} row(s) not in legacy deleted`);
}

async function ensureTables() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS sync_state (
      table_name   text PRIMARY KEY,
      last_run     timestamptz,
      rows_changed integer,
      rows_deleted integer,
      rows_skipped integer,
      last_error   text
    );
    CREATE TABLE IF NOT EXISTS sync_skipped (
      table_name text NOT NULL,
      row_key    text NOT NULL,
      error      text,
      at         timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (table_name, row_key)
    );`);
}

async function runPass(full) {
  // advisory locks belong to a session, so hold one connection for the whole pass
  const lockClient = await pgPool.connect();
  const lock = await lockClient.query(`SELECT pg_try_advisory_lock($1) AS ok`, [LOCK_ID]);
  if (!lock.rows[0].ok) {
    lockClient.release();
    log('another sync is running, skipping this pass');
    return false;
  }
  try {
    const cold = cache == null;
    if (cold) {
      log('no local cache: comparing every row and pruning Postgres rows that are not in legacy');
      cache = {};
      full = true;
    }
    const plans = await loadPlans();
    const seen = new Map();
    let failed = false;
    for (const plan of plans) {
      try {
        seen.set(plan.name, await syncTable(plan, full));
      } catch (err) {
        failed = true;
        log(`${plan.name}: FAILED ${err.message}`);
        await pgPool.query(
          `INSERT INTO sync_state (table_name, last_run, last_error) VALUES ($1, now(), $2)
           ON CONFLICT (table_name) DO UPDATE SET last_run = now(), last_error = EXCLUDED.last_error`,
          [plan.name, String(err.message).slice(0, 500)],
        );
      }
    }
    if (cold) {
      for (const plan of [...plans].reverse()) {
        if (!seen.has(plan.name)) continue;
        try {
          await pruneTable(plan, seen.get(plan.name));
        } catch (err) {
          log(`${plan.name}: prune FAILED ${err.message}`);
        }
      }
    }
    await saveCache();
    return full && !failed;
  } finally {
    await lockClient.query(`SELECT pg_advisory_unlock($1)`, [LOCK_ID]).catch(() => {});
    lockClient.release();
  }
}

async function main() {
  cache = await loadCache();
  await legacyPool.connect();
  await ensureTables();
  const args = process.argv.slice(2);
  if (args.includes('--full') || args.includes('--once')) {
    await runPass(args.includes('--full'));
    return;
  }
  log(`sync running every ${INTERVAL_MIN} min, full compare every ${FULL_EVERY_MIN} min`);
  let lastFull = 0;
  for (;;) {
    const started = Date.now();
    try {
      const full = started - lastFull >= FULL_EVERY_MIN * 60000;
      if (await runPass(full)) lastFull = started;
    } catch (err) {
      log(`pass FAILED ${err.message}`);
    }
    const wait = Math.max(0, INTERVAL_MIN * 60000 - (Date.now() - started));
    await new Promise((r) => setTimeout(r, wait));
  }
}

main()
  .catch((err) => {
    log(`fatal: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await legacyPool.close().catch(() => {});
    await pgPool.end().catch(() => {});
  });
