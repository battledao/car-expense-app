@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$server = Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue; if (-not $server) { Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','npm run dev' -WorkingDirectory (Get-Location).Path -WindowStyle Hidden; Start-Sleep -Seconds 2 }; Start-Process 'http://127.0.0.1:5173'"
