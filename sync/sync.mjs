// One-way sync: legacy SQL Server (store) -> Postgres (Supabase, used by the Vercel ERP and POS).
//
//   node --env-file=.env sync.mjs          run forever: incremental every SYNC_INTERVAL_MINUTES,
//                                          full copy + reconcile once a night at FULL_SYNC_HOUR
//   node --env-file=.env sync.mjs --once   one incremental pass, then exit
//   node --env-file=.env sync.mjs --full   one full copy + reconcile, then exit
//
// Only SELECTs are sent to SQL Server. Rows entered in the new app use ids >= TRIAL_ID_START
// (see setup.mjs) and are never overwritten or deleted.

import sql from 'mssql';
import pg from 'pg';
import { TABLES } from './tables.mjs';

const env = process.env;
const TRIAL_ID_START = Number(env.TRIAL_ID_START ?? 900000000);
const INTERVAL_MIN = Number(env.SYNC_INTERVAL_MINUTES ?? 5);
const FULL_SYNC_HOUR = Number(env.FULL_SYNC_HOUR ?? 2);
const OVERLAP_MIN = 10; // re-read rows modified shortly before the watermark, for late commits
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

// Column lists per table, matched case-insensitively (legacy names may be mixed case).
async function loadColumns() {
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
    const has = (c) => c && cols.includes(c);
    plans.push({
      ...t,
      legacyTable: src.table,
      cols,
      legacyName: (c) => src.cols.get(c),
      changed: has(t.changed) ? t.changed : null,
      idCol: has(t.idCol ?? 'id') ? (t.idCol ?? 'id') : null,
      trialKey: has(t.trialKey ?? (t.seq ? 'id' : null)) ? (t.trialKey ?? 'id') : null,
    });
  }
  return plans;
}

async function getState(table) {
  const r = await pgPool.query(`SELECT last_changed, last_id FROM sync_state WHERE table_name = $1`, [table]);
  return r.rows[0] ?? null;
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
async function writeBatch(client, plan, rows) {
  const params = (rs) => rs.flatMap((r) => plan.cols.map((c) => r[c] ?? null));
  await client.query('SAVEPOINT batch');
  try {
    await client.query(upsertSql(plan, rows.length), params(rows));
    await client.query('RELEASE SAVEPOINT batch');
    return 0;
  } catch {
    await client.query('ROLLBACK TO SAVEPOINT batch');
  }
  let skipped = 0;
  for (const row of rows) {
    await client.query('SAVEPOINT row');
    try {
      await client.query(upsertSql(plan, 1), params([row]));
      await client.query('RELEASE SAVEPOINT row');
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT row');
      const key = Object.fromEntries(plan.pk.map((c) => [c, row[c]]));
      await client.query(
        `INSERT INTO sync_skipped (table_name, row_key, error) VALUES ($1, $2, $3)`,
        [plan.name, JSON.stringify(key), String(err.message).slice(0, 500)],
      );
      skipped++;
    }
  }
  return skipped;
}

// Same key whichever side the row came from (pg returns bigint as string, mssql as number).
const keyOf = (plan, row) =>
  JSON.stringify(plan.pk.map((c) => (row[c] instanceof Date ? row[c].toISOString() : String(row[c]))));

// Copies one table. Incremental: rows changed since the watermark, or newer than the last id.
// Full: every row; returns the set of legacy keys for reconcile.
async function syncTable(plan, full) {
  const state = full ? null : await getState(plan.name);
  const select = plan.cols.map((c) => `${b(plan.legacyName(c))} AS ${b(c)}`).join(', ');
  const request = legacyPool.request();
  let where = '';
  if (state) {
    const parts = [];
    if (plan.changed && state.last_changed) {
      request.input('since', sql.DateTime2, new Date(state.last_changed.getTime() - OVERLAP_MIN * 60000));
      parts.push(`${b(plan.legacyName(plan.changed))} >= @since`);
    }
    if (plan.idCol && state.last_id != null) {
      request.input('lastId', sql.BigInt, Number(state.last_id));
      parts.push(`${b(plan.legacyName(plan.idCol))} > @lastId`);
    }
    // nothing to filter on: leave the table to the nightly full pass
    if (!parts.length) return null;
    where = `WHERE ${parts.join(' OR ')}`;
  }

  const batchSize = Math.min(500, Math.floor(MAX_PARAMS / plan.cols.length));
  const keys = full ? new Set() : null;
  let maxChanged = state?.last_changed ?? null;
  let maxId = state?.last_id != null ? Number(state.last_id) : null;
  let rows = [];
  let copied = 0;
  let skipped = 0;

  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    await new Promise((resolve, reject) => {
      let chain = Promise.resolve();
      request.stream = true;
      request.on('row', (row) => {
        if (keys) keys.add(keyOf(plan, row));
        const changed = plan.changed ? row[plan.changed] : null;
        if (changed && (!maxChanged || changed > maxChanged)) maxChanged = changed;
        const id = plan.idCol ? Number(row[plan.idCol]) : null;
        if (id != null && !Number.isNaN(id) && (maxId == null || id > maxId)) maxId = id;
        rows.push(row);
        if (rows.length >= batchSize) {
          const batch = rows;
          rows = [];
          request.pause();
          chain = chain
            .then(() => writeBatch(client, plan, batch))
            .then((s) => {
              skipped += s;
              copied += batch.length;
              request.resume();
            })
            .catch(reject);
        }
      });
      request.on('error', reject);
      request.on('done', () => {
        chain
          .then(async () => {
            if (rows.length) {
              skipped += await writeBatch(client, plan, rows);
              copied += rows.length;
            }
          })
          .then(resolve, reject);
      });
      request.query(`SELECT ${select} FROM [dbo].${b(plan.legacyTable)} ${where}`);
    });
    await client.query(
      `INSERT INTO sync_state (table_name, last_changed, last_id, last_run, rows_copied, rows_skipped, last_error)
       VALUES ($1, $2, $3, now(), $4, $5, NULL)
       ON CONFLICT (table_name) DO UPDATE SET last_changed = EXCLUDED.last_changed, last_id = EXCLUDED.last_id,
         last_run = now(), rows_copied = EXCLUDED.rows_copied, rows_skipped = EXCLUDED.rows_skipped, last_error = NULL`,
      [plan.name, maxChanged, maxId, copied, skipped],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  if (copied) log(`${plan.name}: ${copied} row(s) copied${skipped ? `, ${skipped} skipped` : ''}`);
  return keys;
}

// Deletes Postgres rows that no longer exist in legacy. Never touches trial rows,
// and skips tables that have no way to tell trial rows apart.
async function reconcileTable(plan, legacyKeys) {
  if (!plan.trialKey || !legacyKeys) return;
  const r = await pgPool.query(
    `SELECT ${plan.pk.map(q).join(',')} FROM ${q(plan.name)} WHERE ${q(plan.trialKey)} < $1`,
    [TRIAL_ID_START],
  );
  const gone = r.rows.filter((row) => !legacyKeys.has(keyOf(plan, row)));
  if (!gone.length) return;
  for (let i = 0; i < gone.length; i += 1000) {
    const chunk = gone.slice(i, i + 1000);
    const n = plan.pk.length;
    const tuples = chunk.map((_, k) => `(${plan.pk.map((__, j) => `$${k * n + j + 1}`).join(',')})`);
    await pgPool.query(
      `DELETE FROM ${q(plan.name)} WHERE (${plan.pk.map(q).join(',')}) IN (${tuples.join(',')})`,
      chunk.flatMap((row) => plan.pk.map((c) => row[c])),
    );
  }
  log(`${plan.name}: ${gone.length} row(s) deleted (gone from legacy)`);
}

async function ensureTables() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS sync_state (
      table_name   text PRIMARY KEY,
      last_changed timestamptz,
      last_id      bigint,
      last_run     timestamptz,
      rows_copied  integer,
      rows_skipped integer,
      last_error   text
    );
    CREATE TABLE IF NOT EXISTS sync_skipped (
      id         bigserial PRIMARY KEY,
      table_name text NOT NULL,
      row_key    jsonb NOT NULL,
      error      text,
      at         timestamptz NOT NULL DEFAULT now()
    );`);
}

async function runPass(full) {
  // advisory locks belong to a session, so hold one connection for the whole pass
  const lockClient = await pgPool.connect();
  const lock = await lockClient.query(`SELECT pg_try_advisory_lock($1) AS ok`, [LOCK_ID]);
  if (!lock.rows[0].ok) {
    lockClient.release();
    log('another sync is running, skipping this pass');
    return;
  }
  try {
    const plans = await loadColumns();
    const keys = new Map();
    for (const plan of plans) {
      try {
        keys.set(plan.name, await syncTable(plan, full || !(await getState(plan.name))));
      } catch (err) {
        log(`${plan.name}: FAILED ${err.message}`);
        await pgPool.query(
          `INSERT INTO sync_state (table_name, last_run, last_error) VALUES ($1, now(), $2)
           ON CONFLICT (table_name) DO UPDATE SET last_run = now(), last_error = EXCLUDED.last_error`,
          [plan.name, String(err.message).slice(0, 500)],
        );
      }
    }
    if (full) {
      for (const plan of [...plans].reverse()) {
        try {
          await reconcileTable(plan, keys.get(plan.name));
        } catch (err) {
          log(`${plan.name}: reconcile FAILED ${err.message}`);
        }
      }
      await pgPool.query(
        `INSERT INTO sync_state (table_name, last_run) VALUES ('__full__', now())
         ON CONFLICT (table_name) DO UPDATE SET last_run = now()`,
      );
    }
  } finally {
    await lockClient.query(`SELECT pg_advisory_unlock($1)`, [LOCK_ID]).catch(() => {});
    lockClient.release();
  }
}

async function fullDue() {
  if (new Date().getHours() !== FULL_SYNC_HOUR) return false;
  const r = await pgPool.query(`SELECT last_run FROM sync_state WHERE table_name = '__full__'`);
  const lastRun = r.rows[0]?.last_run;
  return !lastRun || Date.now() - lastRun.getTime() > 20 * 60 * 60 * 1000;
}

async function main() {
  await legacyPool.connect();
  await ensureTables();
  const args = process.argv.slice(2);
  if (args.includes('--full') || args.includes('--once')) {
    await runPass(args.includes('--full'));
    return;
  }
  log(`sync running every ${INTERVAL_MIN} min, full pass at ${FULL_SYNC_HOUR}:00`);
  for (;;) {
    const started = Date.now();
    try {
      await runPass(await fullDue());
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
