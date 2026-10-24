@echo off
rem Stops Harmony Kitchen Sync and removes its Windows task. Right-click, Run as administrator.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Stop-ScheduledTask -TaskName 'Harmony Kitchen Sync' -ErrorAction SilentlyContinue;" ^
  "Unregister-ScheduledTask -TaskName 'Harmony Kitchen Sync' -Confirm:$false -ErrorAction SilentlyContinue"
taskkill /IM hk-sync.exe /F >nul 2>&1
echo Harmony Kitchen Sync is stopped and removed. The files in this folder are left as they are.
pause
