@echo off
setlocal

pushd "%~dp0"

echo Running build:data...
call npm run build:data
if errorlevel 1 (
  echo.
  echo build:data に失敗しました。
  popd
  exit /b %errorlevel%
)

echo.
echo Running generate...
call npm run generate
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo generate に失敗しました。
)

popd
exit /b %EXIT_CODE%
