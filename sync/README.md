# Legacy to new app sync

One-way copy of the store's legacy SQL Server database (`db_Harmony`) into the Supabase Postgres
used by harmonykitchenerp.vercel.app and harmonykitchenpos.vercel.app, so the store can trial the new
apps on real data.

- Runs on the always-on PC at the store and connects out to Supabase. No port is opened at the store.
- Sends only `SELECT` to SQL Server.
- Every 5 minutes it compares legacy rows with what it last wrote and writes only rows that changed.
  Legacy `ModifiedDate` is not used: POS voids, discount recalcs and stock updates change rows without it.
  The comparison uses hashes kept in `sync-cache.json` next to the script.
- Small tables are read whole every pass, so deletes in legacy show up within 5 minutes. The four large tables
  (POS headers, details, payments, stock flow details) are limited to rows created in the last 7 days, and
  read whole every hour (`FULL_EVERY_MINUTES`), which also catches their deletes and older edits.
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
3. **Sync PC:** copy the built `dist` folder (see Building) and run `install.bat` as administrator. It opens a
   settings screen in the browser (`hk-sync.exe --config`, served on 127.0.0.1) where the connections are entered
   and tested; "Save and start sync" writes `hk-sync.env`, moves new-app ids to the trial range (`--setup`), and
   registers `hk-sync.exe` as a Windows task that starts with Windows. No Node or codebase is needed on that PC;
   `dist/README.txt` is the store-side guide.
   The first full copy replaces whatever the synced tables in Supabase hold today with legacy data, and removes
   rows below the trial id range that are not in legacy. Deleting `sync-cache.json` makes the next pass do this again.
   The agent takes a Postgres advisory lock, so two copies never run at once.

## Building

On a Windows PC with Node 20.12 or newer, in this folder: `npm install`, then `npm run build`. That writes
`dist/` with `hk-sync.exe` (the agent with Node built in), `install.bat`, `uninstall.bat`,
`hk-sync.env.example` and `README.txt`. For development, `npm run check|setup|once|full|start` run the same
code with Node, reading `.env` in this folder.

## Checking on it

```sql
SELECT table_name, last_run, rows_changed, rows_deleted, rows_skipped, last_error FROM sync_state ORDER BY last_run DESC;
SELECT table_name, row_key, error, at FROM sync_skipped ORDER BY at DESC LIMIT 50;
```

`sync_skipped` lists legacy rows Postgres refused (usually a detail row whose header is missing in legacy).

## Wiping trial data

Trial rows are the ones with `id >= 900000000` (or a parent id in that range for payment and promo tables).
Delete them table by table, details before headers.
