Harmony Kitchen Sync
====================

Copies the store's current system (SQL Server on the ERP PC) into the new app's database every
5 minutes, so the new ERP and POS can be tried out on real data. It only reads from SQL Server.
Nothing entered in the new app goes back to the current system.

Install (once, on the PC that stays on all day)
1. Copy this whole folder to the PC, for example to C:\HarmonySync.
2. Right-click install.bat, choose "Run as administrator".
   A settings screen opens in the browser.
3. Fill in the SQL Server and Supabase details and press "Test connections".
4. When the test passes, press "Save and start sync". From then on the sync starts by itself
   whenever Windows starts. You can close the browser tab and the black window.

The first run copies everything and replaces what the new app's database holds for those tables.

Change settings later
- Run install.bat as administrator again, change the values, and press "Save and start sync".

Check that it is working
- Open hk-sync.log in this folder. Each pass logs the tables that changed.
- "waiting for databases" means SQL Server or the internet is not reachable yet.

Stop or remove
- Right-click uninstall.bat, choose "Run as administrator".

Start over from scratch
- Run uninstall.bat, delete sync-cache.json, then run install.bat again.
