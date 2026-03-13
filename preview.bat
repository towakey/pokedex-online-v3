@echo off
setlocal

pushd "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $response = Invoke-WebRequest -UseBasicParsing 'http://localhost:3000/' -TimeoutSec 2; if ($response.StatusCode -ge 200) { exit 0 } } catch { exit 1 }"
if "%errorlevel%"=="0" (
  start "" "http://localhost:3000/"
  popd
  exit /b 0
)

start "pokedex-online-v3 dev server" cmd /k "cd /d ""%~dp0"" && npm run dev"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline = (Get-Date).AddMinutes(2); while ((Get-Date) -lt $deadline) { try { $response = Invoke-WebRequest -UseBasicParsing 'http://localhost:3000/' -TimeoutSec 2; if ($response.StatusCode -ge 200) { Start-Process 'http://localhost:3000/'; exit 0 } } catch {} Start-Sleep -Seconds 1 }; exit 1"

set "exit_code=%errorlevel%"
if not "%exit_code%"=="0" (
  echo Preview could not be opened automatically. Please check the dev server window.
)

popd
exit /b %exit_code%
