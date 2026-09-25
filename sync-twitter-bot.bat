@echo off
setlocal
set "SOURCE_DIR=%~dp0twitter-bot"
set "TARGET_DIR=%~dp0.output\public\twitter-bot"

if not exist "%SOURCE_DIR%" (
  echo twitter-bot ディレクトリが見つかりません。
  exit /b 1
)

if not exist "%~dp0.output\public" (
  echo .output\public ディレクトリが見つかりません。
  exit /b 1
)

REM data/ はサーバー上で実行時生成されるため同期対象外
robocopy "%SOURCE_DIR%" "%TARGET_DIR%" /E /R:0 /W:0 /XD "data" ".git" /XF ".env"
set "ROBOCOPY_EXIT=%ERRORLEVEL%"
if %ROBOCOPY_EXIT% GEQ 8 (
  exit /b %ROBOCOPY_EXIT%
)

REM 本番用 .env.production を同梱 (X APIキー・管理パスワード用)
if exist "%~dp0.env.production" (
  copy /Y "%~dp0.env.production" "%TARGET_DIR%\.env" >nul
) else (
  echo Warning: .env.production が見つかりません。APIキーは別途サーバーに配置してください。
)

exit /b 0
