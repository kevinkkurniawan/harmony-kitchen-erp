// One-time Postgres setup before trial users start entering data:
// moves the id sequences of synced tables to TRIAL_ID_START, so rows created in the new app
// never collide with ids coming from legacy. Safe to run again.
//
//   node --env-file=.env setup.mjs

import pg from 'pg';
import { TABLES } from './tables.mjs';

const env = process.env;
const TRIAL_ID_START = Number(env.TRIAL_ID_START ?? 900000000);

const client = new pg.Client({
  connectionString: env.DATABASE_URL,
  ssl: env.PG_SSL === 'false' ? false : { rejectUnauthorized: env.PG_SSL_REJECT_UNAUTHORIZED === 'true' },
});

await client.connect();
try {
  for (const t of TABLES.filter((t) => t.seq)) {
    const r = await client.query(`SELECT pg_get_serial_sequence($1, 'id') AS seq`, [`public.${t.name}`]);
    const seq = r.rows[0]?.seq;
    if (!seq) {
      console.log(`${t.name}: no id sequence, skipped`);
      continue;
    }
    const next = await client.query(
      `SELECT setval($1, GREATEST($2::bigint, (SELECT COALESCE(MAX(id), 0) + 1 FROM "${t.name}" WHERE id >= $2)), false) AS next`,
      [seq, TRIAL_ID_START],
    );
    console.log(`${t.name}: next id ${next.rows[0].next}`);
  }
} finally {
  await client.end();
}
