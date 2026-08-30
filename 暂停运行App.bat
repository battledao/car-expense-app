@echo off
setlocal
cd /d "%~dp0"

set "APP_PID="
set "APP_IMAGE="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":5173 .*LISTENING"') do set "APP_PID=%%P"

if not defined APP_PID goto not_running

for /f "tokens=1 delims=," %%I in ('tasklist /fi "PID eq %APP_PID%" /fo csv /nh') do set "APP_IMAGE=%%~I"
if /i "%APP_IMAGE%"=="node.exe" goto stop_app

echo Port 5173 is in use by another program. Nothing was stopped.
goto finish

:stop_app
taskkill /pid %APP_PID% /f >nul
echo App stopped.
goto finish

:not_running
echo App is not running.

:finish
pause
