@echo off
rem Opens the Harmony Kitchen Sync settings screen. From there you test the connections and start the
rem sync as a Windows task that starts with Windows. Right-click, Run as administrator.
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 (
  echo Please right-click install.bat and choose Run as administrator.
  pause
  exit /b 1
)

hk-sync.exe --config
