@echo off
setlocal

pushd "%~dp0"

if not exist ".env" (
  echo .env が見つかりません。
  popd
  exit /b 1
)

call load-env.bat ".env"
if errorlevel 1 (
  popd
  exit /b 1
)

echo Running generate...
call npm run generate
if errorlevel 1 (
  echo.
  echo generate に失敗しました。
  popd
  exit /b %errorlevel%
)

if not exist "dist\index.html" (
  echo dist\index.html が見つかりません。
  echo generate 実行後も dist\index.html が見つかりません。
  popd
  exit /b 1
)

set "PORT=%~1"
if "%PORT%"=="" set "PORT=4173"
set "DIST_ROOT=%CD%\dist"

echo Serving "%DIST_ROOT%" at http://localhost:%PORT%/
echo Ctrl+C で停止できます。

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$port = [int]$env:PORT; $root = [System.IO.Path]::GetFullPath($env:DIST_ROOT); $listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add(('http://localhost:{0}/' -f $port)); $listener.Start(); Start-Process ('http://localhost:{0}/' -f $port); try { while ($listener.IsListening) { $context = $listener.GetContext(); $relativePath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/')); if ([string]::IsNullOrWhiteSpace($relativePath)) { $relativePath = 'index.html' }; $relativePath = $relativePath -replace '/', '\'; $candidate = Join-Path $root $relativePath; if (Test-Path $candidate -PathType Container) { $candidate = Join-Path $candidate 'index.html' } elseif (-not (Test-Path $candidate -PathType Leaf) -and [string]::IsNullOrEmpty([System.IO.Path]::GetExtension($candidate))) { $candidate = Join-Path $candidate 'index.html' }; if ((Test-Path $candidate -PathType Leaf) -and ([System.IO.Path]::GetFullPath($candidate).StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase))) { $extension = [System.IO.Path]::GetExtension($candidate).ToLowerInvariant(); $contentType = switch ($extension) { '.html' { 'text/html; charset=utf-8' } '.css' { 'text/css; charset=utf-8' } '.js' { 'text/javascript; charset=utf-8' } '.mjs' { 'text/javascript; charset=utf-8' } '.json' { 'application/json; charset=utf-8' } '.svg' { 'image/svg+xml' } '.png' { 'image/png' } '.jpg' { 'image/jpeg' } '.jpeg' { 'image/jpeg' } '.gif' { 'image/gif' } '.webp' { 'image/webp' } '.ico' { 'image/x-icon' } default { 'application/octet-stream' } }; $bytes = [System.IO.File]::ReadAllBytes($candidate); $context.Response.StatusCode = 200; $context.Response.ContentType = $contentType; $context.Response.ContentLength64 = $bytes.Length; $context.Response.OutputStream.Write($bytes, 0, $bytes.Length) } else { $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not Found'); $context.Response.StatusCode = 404; $context.Response.ContentType = 'text/plain; charset=utf-8'; $context.Response.ContentLength64 = $bytes.Length; $context.Response.OutputStream.Write($bytes, 0, $bytes.Length) }; $context.Response.OutputStream.Close() } } finally { if ($listener) { $listener.Stop(); $listener.Close() } }"

set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
