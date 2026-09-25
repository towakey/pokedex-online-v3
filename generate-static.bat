@echo off
setlocal EnableDelayedExpansion

set "SKIP_DATA=0"
if /I "%~1"=="--skip-data" set "SKIP_DATA=1"

pushd "%~dp0"

if not exist ".env.production" (
  echo .env.production が見つかりません。
  popd
  exit /b 1
)

REM 継承された開発用値が残らないよう、対象のNuxt設定だけを先に空にする
set "NUXT_PUBLIC_APP_BASE_URL="
set "NUXT_PUBLIC_POKEDEX_API_BASE_URL="
set "NUXT_PUBLIC_SITE_URL="
set "NUXT_PRERENDER_CONCURRENCY="
set "NUXT_PRERENDER_CRAWL_LINKS="
set "NUXT_PRERENDER_ROUTES="
set "NUXT_PRERENDER_SAMPLE="

call load-env.bat ".env.production"
if errorlevel 1 (
  popd
  exit /b 1
)

echo Validating production configuration...
call npm run validate:production-config
if errorlevel 1 (
  echo.
  echo 本番設定の検証に失敗しました。
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
echo Running build:og-cards...
call npm run build:og-cards
if errorlevel 1 (
  echo.
  echo build:og-cards に失敗しました。
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
) else (
  echo.
  echo Preparing and validating public output...
  call prepare-public-output.bat
  set "EXIT_CODE=!ERRORLEVEL!"
  if not "%EXIT_CODE%"=="0" (
    echo.
    echo 公開成果物の準備または検証に失敗しました。
  )
)

popd
exit /b %EXIT_CODE%
