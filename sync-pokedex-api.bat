@echo off
setlocal
set "SOURCE_DIR=%~dp0pokedex"
set "TARGET_DIR=%~dp0.output\public\pokedex"

if not exist "%SOURCE_DIR%" (
  echo pokedex ディレクトリが見つかりません。
  exit /b 1
)

if not exist "%~dp0.output\public" (
  echo .output\public ディレクトリが見つかりません。
  exit /b 1
)

robocopy "%SOURCE_DIR%" "%TARGET_DIR%" /E /R:0 /W:0 /XD ".git"
set "ROBOCOPY_EXIT=%ERRORLEVEL%"
if %ROBOCOPY_EXIT% GEQ 8 (
  exit /b %ROBOCOPY_EXIT%
)

exit /b 0
