@echo off
set "ENV_FILE=%~1"
if "%ENV_FILE%"=="" set "ENV_FILE=.env"
set "ENV_PATH=%~dp0%ENV_FILE%"

if not exist "%ENV_PATH%" (
  echo %ENV_FILE% が見つかりません。
  exit /b 1
)

for /f "usebackq delims=" %%L in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$path = [System.IO.Path]::GetFullPath('%ENV_PATH%'); foreach ($line in [System.IO.File]::ReadAllLines($path)) { if (-not [string]::IsNullOrWhiteSpace($line) -and $line -match '^\s*([^#][^=]*)=(.*)$') { $name = $matches[1].Trim(); if ($name) { '{0}={1}' -f $name, $matches[2] } } }"`) do set "%%L"

exit /b 0
