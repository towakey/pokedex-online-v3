@echo off
setlocal EnableDelayedExpansion

REM auto mode: upload-to-server.bat auto で全プロンプトを既定値でスキップ
set "AUTO_MODE="
if /i "%~1"=="auto" set "AUTO_MODE=1"
if /i "%~1"=="--auto" set "AUTO_MODE=1"

echo ====================================
echo    Static Site Upload Script (Nuxt v3)
echo ====================================
echo.
if defined AUTO_MODE echo [AUTO MODE] All prompts will use default values.

REM ===========================================
REM SSH Connection Settings (Default Values)
REM ===========================================

set DEFAULT_SSH_HOST=kyosserver.sakura.ne.jp
set DEFAULT_SSH_USER=kyosserver
set DEFAULT_REMOTE_PATH=/home/kyosserver/www/pokedex-online
set DEFAULT_SSH_KEY_FILE=%USERPROFILE%\.ssh\id_ed25519
set DEFAULT_SSH_PORT=22

REM ===========================================
REM Exclude Settings (files to skip during upload)
REM ===========================================
REM Exclude extensions (space-separated, without dot)
set "EXCLUDE_EXTENSIONS=csv xlsx sql"
REM Exclude directory pattern (files matching this pattern will be excluded)
set "EXCLUDE_DIR_PATTERN="

REM ===========================================
REM Sync Mode Settings
REM ===========================================
REM SYNC_MODE: full = delete remote files not in local (complete sync)
REM            update = only upload new/modified files (incremental)
set "DEFAULT_SYNC_MODE=update"

REM ===========================================

if defined AUTO_MODE (
    set "SSH_HOST=%DEFAULT_SSH_HOST%"
    set "SSH_USER=%DEFAULT_SSH_USER%"
    set "REMOTE_PATH=%DEFAULT_REMOTE_PATH%"
    set "SSH_PORT=%DEFAULT_SSH_PORT%"
    set "SSH_KEY_FILE=%DEFAULT_SSH_KEY_FILE%"
) else (
    REM SSH Connection Information Input
    echo Enter SSH connection information ^(Press Enter for default values^):
    echo.

    REM SSH_HOST Input
    set /p "SSH_HOST=SSH Host [%DEFAULT_SSH_HOST%]: "
    if "%SSH_HOST%" == "" set SSH_HOST=%DEFAULT_SSH_HOST%

    REM SSH_USER Input
    set /p "SSH_USER=SSH User [%DEFAULT_SSH_USER%]: "
    if "%SSH_USER%" == "" set SSH_USER=%DEFAULT_SSH_USER%

    REM REMOTE_PATH Input
    echo.
    echo Enter upload destination directory:
    echo Examples: /home/user/public_html, /var/www/html, /home/user/www
    set /p "REMOTE_PATH=Remote Path [%DEFAULT_REMOTE_PATH%]: "
    if "%REMOTE_PATH%" == "" set REMOTE_PATH=%DEFAULT_REMOTE_PATH%

    REM SSH_PORT Input
    set /p "SSH_PORT=SSH Port [%DEFAULT_SSH_PORT%]: "
    if "%SSH_PORT%" == "" set SSH_PORT=%DEFAULT_SSH_PORT%

    REM SSH_KEY_FILE Input
    echo.
    echo SSH private key file path ^(leave empty for password auth^):
    set /p "SSH_KEY_FILE=SSH Key File [%DEFAULT_SSH_KEY_FILE%]: "
    if "%SSH_KEY_FILE%" == "" set SSH_KEY_FILE=%DEFAULT_SSH_KEY_FILE%
)

echo.
echo ===========================================

REM Configuration Check
if "%SSH_HOST%" == "your-server.com" (
    echo [ERROR] SSH connection settings incomplete.
    echo Please enter a valid SSH_HOST.
    echo.
    pause
    exit /b 1
)

REM Display Configuration for Confirmation
echo Please confirm the settings:
echo SSH Host: %SSH_HOST%
echo SSH User: %SSH_USER%
echo Remote Path: %REMOTE_PATH%
echo SSH Port: %SSH_PORT%
if not "%SSH_KEY_FILE%" == "" (
    echo SSH Key File: %SSH_KEY_FILE%
) else (
    echo SSH Auth: Password
)
echo.
if defined AUTO_MODE (
    set "CONFIRM=Y"
) else (
    echo Start upload with these settings? ^(Y/N^)
    set /p "CONFIRM="
)
if /i not "%CONFIRM%" == "Y" (
    echo Upload cancelled.
    pause
    exit /b 0
)

REM Move to project directory
cd /d "%~dp0"

REM Decide whether to skip generation if existing output is found
set SKIP_GENERATE=0
if not defined AUTO_MODE if exist ".output\public\*" (
    echo Detected existing static files under .output\public
    echo Skip static site generation and use existing files? ^(Y/N^)
    set /p "CONFIRM_SKIP_GEN="
    if /i "!CONFIRM_SKIP_GEN!"=="Y" (
        set SKIP_GENERATE=1
    )
)

if "!SKIP_GENERATE!"=="1" (
    echo [1/4] Preparing and validating existing production output...
    call prepare-public-output.bat
    if errorlevel 1 (
        echo [ERROR] Existing output validation failed. Upload cancelled.
        pause
        exit /b 1
    )
) else (
    echo [1/4] Starting production static site generation...
    echo.

    call generate-static.bat
    if errorlevel 1 (
        echo [ERROR] Static site generation or validation failed.
        pause
        exit /b 1
    )
)

echo.
echo [2/4] Checking generated files...

if not exist ".output\public" (
    echo [ERROR] Output directory '.output\public' not found.
    pause
    exit /b 1
)

if exist ".output\public\.htaccess" (
    echo Confirm: .output\public\.htaccess is present.
) else (
    echo Warning: .output\public\.htaccess not found after copy phase.
)

REM Count files
for /f %%i in ('dir /s /b ".output\public\*" ^| %SystemRoot%\System32\find.exe /c /v ""') do set FILE_COUNT=%%i
echo Generated file count: !FILE_COUNT! files

echo.
echo [3/4] Verifying SSH connection settings...
echo SSH Host: %SSH_HOST%
echo SSH User: %SSH_USER%
echo SSH Port: %SSH_PORT%
echo Remote Path: %REMOTE_PATH%
if not "%SSH_KEY_FILE%" == "" (
    echo SSH Key File: %SSH_KEY_FILE%
)
echo.

REM Test SSH connection
echo Testing SSH connection...
echo.
echo NOTE: If using password auth, you may be prompted multiple times.
echo       Consider setting up SSH key auth to avoid this.
echo       See: setup-ssh-key.bat
echo.
if not "%SSH_KEY_FILE%" == "" (
    ssh -i "%SSH_KEY_FILE%" -p %SSH_PORT% -o ConnectTimeout=10 -o BatchMode=yes %SSH_USER%@%SSH_HOST% "echo 'SSH connection successful'"
) else (
    ssh -p %SSH_PORT% -o ConnectTimeout=10 %SSH_USER%@%SSH_HOST% "echo 'SSH connection successful'"
)

if errorlevel 1 (
    echo [WARNING] SSH connection test failed. Please check authentication.
    if defined AUTO_MODE (
        echo [ERROR] AUTO_MODE: aborting on SSH connection failure.
        exit /b 1
    )
    echo Continue anyway? ^(Y/N^)
    set /p "CONTINUE="
    if /i not "!CONTINUE!" == "Y" (
        echo Upload cancelled.
        pause
        exit /b 1
    )
)

echo.
echo [4/4] Starting file upload...

REM Create backup of remote directory (optional)
if defined AUTO_MODE (
    set "CREATE_BACKUP=N"
) else (
    echo Create backup of remote directory? ^(Y/N^)
    set /p "CREATE_BACKUP="
)
if /i "!CREATE_BACKUP!" == "Y" (
    echo Creating backup...
    set BACKUP_NAME=backup_!date:~0,4!!date:~5,2!!date:~8,2!_!time:~0,2!!time:~3,2!!time:~6,2!
    set BACKUP_NAME=!BACKUP_NAME: =0!
    
    if not "%SSH_KEY_FILE%" == "" (
        ssh -i "%SSH_KEY_FILE%" -p %SSH_PORT% %SSH_USER%@%SSH_HOST% "cp -r %REMOTE_PATH% %REMOTE_PATH%_!BACKUP_NAME!"
    ) else (
        ssh -p %SSH_PORT% %SSH_USER%@%SSH_HOST% "cp -r %REMOTE_PATH% %REMOTE_PATH%_!BACKUP_NAME!"
    )
    echo Backup created: %REMOTE_PATH%_!BACKUP_NAME!
)

REM Ask for sync mode
echo.
if defined AUTO_MODE (
    set "SYNC_CHOICE=1"
) else (
    echo Sync mode:
    echo   [1] Update only - upload new/modified files only ^(faster^)
    echo   [2] Full sync - delete remote files not in local ^(complete sync^)
    set /p "SYNC_CHOICE=Select sync mode [1]: "
    if "!SYNC_CHOICE!" == "" set "SYNC_CHOICE=1"
)
if "!SYNC_CHOICE!" == "2" (
    set "SYNC_MODE=full"
) else (
    set "SYNC_MODE=update"
)
echo Selected: !SYNC_MODE! mode
echo.

REM Build exclude options from EXCLUDE_EXTENSIONS
set "RSYNC_EXCLUDES="
for %%E in (%EXCLUDE_EXTENSIONS%) do (
    if not "!EXCLUDE_DIR_PATTERN!" == "" (
        set "RSYNC_EXCLUDES=!RSYNC_EXCLUDES! --exclude='!EXCLUDE_DIR_PATTERN!/**/*.%%E'"
    )
)

REM Set rsync delete option based on sync mode
set "RSYNC_DELETE="
if "!SYNC_MODE!" == "full" set "RSYNC_DELETE=--delete"

REM Check if WSL is available for rsync
wsl --list --quiet >nul 2>nul
if errorlevel 1 goto :USE_SCP

echo Uploading using rsync via WSL...
if "!SYNC_MODE!" == "full" (
    echo Mode: Full sync - will delete remote files not present locally
) else (
    echo Mode: Update only - uploading new and modified files only
)

REM Convert Windows path to WSL path
set "WSL_SOURCE=/mnt/c%CD:~2%/.output/public/"
set "WSL_SOURCE=!WSL_SOURCE:\=/!"
set "WSL_KEY="
if not "%SSH_KEY_FILE%" == "" (
    set "WSL_KEY=/mnt/c%SSH_KEY_FILE:~2%"
    set "WSL_KEY=!WSL_KEY:\=/!"
)

REM Build WSL rsync command
set "WSL_EXCLUDES="
for %%E in (%EXCLUDE_EXTENSIONS%) do (
    if not "!EXCLUDE_DIR_PATTERN!" == "" (
        set "WSL_EXCLUDES=!WSL_EXCLUDES! --exclude='!EXCLUDE_DIR_PATTERN!/**/*.%%E'"
    )
)
REM twitter-bot と商品APIの運用データ(SQLite DB)はサーバー側で保持するため除外
set "WSL_EXCLUDES=!WSL_EXCLUDES! --exclude='/twitter-bot/data/' --exclude='/pokedex/products/data/'"
if not "!WSL_EXCLUDES!" == "" (
    echo Exclude patterns:!WSL_EXCLUDES!
)

if not "!WSL_KEY!" == "" (
    REM /mnt/c 上の鍵はパーミッション0777扱いでsshに拒否されるためWSL側に複製して使う
    echo Copying SSH key into WSL...
    wsl bash -c "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cp '!WSL_KEY!' ~/.ssh/id_ed25519 && chmod 600 ~/.ssh/id_ed25519"
    if errorlevel 1 (
        echo [ERROR] Failed to copy SSH key into WSL.
        pause
        exit /b 1
    )
    wsl bash -c "rsync -avz !RSYNC_DELETE! !WSL_EXCLUDES! -e 'ssh -i ~/.ssh/id_ed25519 -p %SSH_PORT% -o StrictHostKeyChecking=no -o BatchMode=yes' '!WSL_SOURCE!' '%SSH_USER%@%SSH_HOST%:%REMOTE_PATH%/'"
) else (
    wsl rsync -avz !RSYNC_DELETE! !WSL_EXCLUDES! -e "ssh -p %SSH_PORT%" "!WSL_SOURCE!" "%SSH_USER%@%SSH_HOST%:%REMOTE_PATH%/"
)

if errorlevel 1 (
    echo [ERROR] rsync upload failed.
    pause
    exit /b 1
)
goto :UPLOAD_DONE

:USE_SCP
echo Uploading using scp...
echo NOTE: scp does not support incremental sync. Consider installing WSL for rsync.

REM Only delete remote files in full sync mode
REM (twitter-bot/data と pokedex/products/data はサーバー側の運用データのため退避して保持)
if "!SYNC_MODE!" == "full" (
    echo Deleting existing files...
    set "PRESERVE_CMD=if [ -d %REMOTE_PATH%/twitter-bot/data ]; then mv %REMOTE_PATH%/twitter-bot/data /tmp/tb_data_$$$$; fi; if [ -d %REMOTE_PATH%/pokedex/products/data ]; then mv %REMOTE_PATH%/pokedex/products/data /tmp/pd_data_$$$$; fi; rm -rf %REMOTE_PATH%/* %REMOTE_PATH%/.*[!.]*; mkdir -p %REMOTE_PATH%/twitter-bot %REMOTE_PATH%/pokedex/products; if [ -d /tmp/tb_data_$$$$ ]; then mv /tmp/tb_data_$$$$ %REMOTE_PATH%/twitter-bot/data; fi; if [ -d /tmp/pd_data_$$$$ ]; then mv /tmp/pd_data_$$$$ %REMOTE_PATH%/pokedex/products/data; fi"
    if not "%SSH_KEY_FILE%" == "" (
        ssh -i "%SSH_KEY_FILE%" -p %SSH_PORT% %SSH_USER%@%SSH_HOST% "!PRESERVE_CMD!"
    ) else (
        ssh -p %SSH_PORT% %SSH_USER%@%SSH_HOST% "!PRESERVE_CMD!"
    )
) else (
    echo Uploading files - overwrite mode...
)

REM Upload files using scp
if not "%SSH_KEY_FILE%" == "" (
    scp -i "%SSH_KEY_FILE%" -P %SSH_PORT% -r ".output\public\*" "%SSH_USER%@%SSH_HOST%:%REMOTE_PATH%/"
) else (
    scp -P %SSH_PORT% -r ".output\public\*" "%SSH_USER%@%SSH_HOST%:%REMOTE_PATH%/"
)

if errorlevel 1 (
    echo [ERROR] scp upload failed.
    pause
    exit /b 1
)

REM Upload .htaccess if present
if exist ".output\public\.htaccess" (
    echo Uploading .htaccess...
    if not "%SSH_KEY_FILE%" == "" (
        scp -i "%SSH_KEY_FILE%" -P %SSH_PORT% ".output\public\.htaccess" "%SSH_USER%@%SSH_HOST%:%REMOTE_PATH%/"
    ) else (
        scp -P %SSH_PORT% ".output\public\.htaccess" "%SSH_USER%@%SSH_HOST%:%REMOTE_PATH%/"
    )
)

REM Upload other dotfiles
dir /b /a ".output\public\.*" >nul 2>nul
if not errorlevel 1 (
    for /f "usebackq delims=" %%F in (`dir /b /a ".output\public\.*"`) do (
        if not "%SSH_KEY_FILE%" == "" (
            scp -i "%SSH_KEY_FILE%" -P %SSH_PORT% -r ".output\public\%%F" "%SSH_USER%@%SSH_HOST%:%REMOTE_PATH%/"
        ) else (
            scp -P %SSH_PORT% -r ".output\public\%%F" "%SSH_USER%@%SSH_HOST%:%REMOTE_PATH%/"
        )
    )
)

REM Upload twitter-bot .env (dotfile inside subdirectory)
if exist ".output\public\twitter-bot\.env" (
    echo Uploading twitter-bot\.env...
    if not "%SSH_KEY_FILE%" == "" (
        scp -i "%SSH_KEY_FILE%" -P %SSH_PORT% ".output\public\twitter-bot\.env" "%SSH_USER%@%SSH_HOST%:%REMOTE_PATH%/twitter-bot/"
    ) else (
        scp -P %SSH_PORT% ".output\public\twitter-bot\.env" "%SSH_USER%@%SSH_HOST%:%REMOTE_PATH%/twitter-bot/"
    )
)

REM Upload products API .env (dotfile inside subdirectory)
if exist ".output\public\pokedex\products\.env" (
    echo Uploading pokedex\products\.env...
    if not "%SSH_KEY_FILE%" == "" (
        scp -i "%SSH_KEY_FILE%" -P %SSH_PORT% ".output\public\pokedex\products\.env" "%SSH_USER%@%SSH_HOST%:%REMOTE_PATH%/pokedex/products/"
    ) else (
        scp -P %SSH_PORT% ".output\public\pokedex\products\.env" "%SSH_USER%@%SSH_HOST%:%REMOTE_PATH%/pokedex/products/"
    )
)

:UPLOAD_DONE
echo.
echo ====================================
echo     Upload Complete!
echo ====================================
echo.
echo Site URL: https://%SSH_HOST%/pokedex-online/
echo Upload destination: %SSH_USER%@%SSH_HOST%:%REMOTE_PATH%
echo Process time: %date% %time%
echo.

REM Check site after upload
if not defined AUTO_MODE (
    echo Check site functionality? ^(Y/N^)
    set /p "OPEN_SITE="
    if /i "!OPEN_SITE!" == "Y" (
        start https://%SSH_HOST%/pokedex-online/
    )

    echo.
    echo Process completed. Press any key to continue.
    pause >nul
)
