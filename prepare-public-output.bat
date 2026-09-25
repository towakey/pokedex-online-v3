@echo off
setlocal

pushd "%~dp0"

if not exist ".output\public" (
  echo [ERROR] Output directory '.output\public' not found.
  popd
  exit /b 1
)

if exist ".htaccess" (
  echo Copying .htaccess...
  copy /Y ".htaccess" ".output\public\.htaccess" >nul
  if errorlevel 1 (
    echo [ERROR] .htaccess copy failed.
    popd
    exit /b 1
  )
)
if exist "public\.htaccess" (
  echo Copying public\.htaccess...
  copy /Y "public\.htaccess" ".output\public\.htaccess" >nul
  if errorlevel 1 (
    echo [ERROR] public\.htaccess copy failed.
    popd
    exit /b 1
  )
)

echo Syncing pokedex API into .output\public...
call sync-pokedex-api.bat
if errorlevel 1 (
  echo [ERROR] pokedex API sync failed.
  popd
  exit /b 1
)

echo Syncing twitter-bot into .output\public...
call sync-twitter-bot.bat
if errorlevel 1 (
  echo [ERROR] twitter-bot sync failed.
  popd
  exit /b 1
)

echo Validating production output...
call npm run validate:production-output
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo [ERROR] Production output validation failed.
  popd
  exit /b %EXIT_CODE%
)

popd
exit /b 0
