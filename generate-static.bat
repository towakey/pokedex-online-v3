@echo off
setlocal

set "SKIP_DATA=0"
if /I "%~1"=="--skip-data" set "SKIP_DATA=1"

pushd "%~dp0"

if not exist ".env.production" (
  echo .env.production が見つかりません。
  popd
  exit /b 1
)

call load-env.bat ".env.production"
if errorlevel 1 (
  popd
  exit /b 1
)

if "%SKIP_DATA%"=="1" (
  echo Skipping build:data...
) else (
  echo Running build:data...
  call npm run build:data
  if errorlevel 1 (
    echo.
    echo build:data に失敗しました。
    popd
    exit /b %errorlevel%
  )
)

echo.
echo Running generate...
call npm run generate
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo generate に失敗しました。
) else (
  echo.
  echo Syncing pokedex API...
  call sync-pokedex-api.bat
  set "EXIT_CODE=%ERRORLEVEL%"
  if not "%EXIT_CODE%"=="0" (
    echo.
    echo pokedex API の同期に失敗しました。
  )
)

popd
exit /b %EXIT_CODE%
