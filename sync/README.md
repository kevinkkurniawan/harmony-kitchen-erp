# Legacy to new app sync

One-way copy of the store's legacy SQL Server database (`db_Harmony`) into the Supabase Postgres
used by harmonykitchenerp.vercel.app and harmonykitchenpos.vercel.app, so the store can trial the new
apps on real data.

- Runs on the always-on PC at the store and connects out to Supabase. No port is opened at the store.
- Sends only `SELECT` to SQL Server.
- Every 5 minutes: copies rows whose `modifieddate` moved or whose id is new.
- Once a night (`FULL_SYNC_HOUR`): copies every row again and deletes Postgres rows that were deleted in legacy.
- Legacy wins: synced rows are overwritten with legacy values.
- Rows entered in the new app get ids from `TRIAL_ID_START` (900,000,000) up and are never touched.
  Nothing goes back to legacy.

The tables and their keys are listed in `tables.mjs`. Columns that exist only in the new app are left as they are,
and `m_user.password` is not copied.

## One-time setup

1. **SQL Server (ERP PC):** create a read-only login for the agent.
   ```sql
   CREATE LOGIN hk_sync_reader WITH PASSWORD = '<strong password>';
   USE db_Harmony;
   CREATE USER hk_sync_reader FOR LOGIN hk_sync_reader;
   ALTER ROLE db_datareader ADD MEMBER hk_sync_reader;
   ```
   SQL Server must accept TCP connections from the sync PC (SQL Server Configuration Manager, TCP/IP enabled,
   Windows firewall open for port 1433 on the store network only).
2. **Supabase:** create a role for the agent (SQL editor).
   ```sql
   CREATE ROLE hk_sync LOGIN PASSWORD '<strong password>';
   GRANT USAGE, CREATE ON SCHEMA public TO hk_sync;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hk_sync;
   GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO hk_sync;
   ```
   Use the session pooler or direct connection string (port 5432), not the transaction pooler.
3. **Sync PC:** install Node.js 20 LTS or newer, copy this folder, then
   ```
   npm install
   copy .env.example .env      (and fill it in)
   npm run setup               (moves new-app ids to the trial range)
   npm run full                (first full copy)
   ```
   The first full copy replaces whatever the synced tables in Supabase hold today with legacy data.
4. **Keep it running:** a Windows Task Scheduler task, triggered at startup, running
   `node --env-file=.env sync.mjs` in this folder, set to restart on failure and to "not start a new instance"
   if one is running. The agent also takes a Postgres advisory lock, so two copies never run at once.

## Checking on it

```sql
SELECT table_name, last_run, rows_copied, rows_skipped, last_error FROM sync_state ORDER BY last_run DESC;
SELECT table_name, row_key, error, at FROM sync_skipped ORDER BY at DESC LIMIT 50;
```

`sync_skipped` lists legacy rows Postgres refused (usually a detail row whose header is missing in legacy).

## Wiping trial data

Trial rows are the ones with `id >= 900000000` (or a parent id in that range for payment and promo tables).
Delete them table by table, details before headers.
