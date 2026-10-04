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

robocopy "%SOURCE_DIR%" "%TARGET_DIR%" /E /R:0 /W:0 /XD ".git" "editor" "products\data"
set "ROBOCOPY_EXIT=%ERRORLEVEL%"
if %ROBOCOPY_EXIT% GEQ 8 (
  exit /b %ROBOCOPY_EXIT%
)

REM 商品APIの本番用 .env を同梱
if exist "%~dp0.env.production" (
  copy /Y "%~dp0.env.production" "%TARGET_DIR%\products\.env" >nul
) else (
  echo Warning: .env.production が見つかりません。商品APIの設定は別途サーバーに配置してください。
)

exit /b 0
