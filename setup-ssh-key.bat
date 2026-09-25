@echo off
setlocal EnableDelayedExpansion

echo ====================================
echo    SSH Key Setup Script
echo ====================================
echo.

REM ===========================================
REM Default Settings
REM ===========================================
set DEFAULT_SSH_HOST=kyosserver.sakura.ne.jp
set DEFAULT_SSH_USER=kyosserver
set DEFAULT_SSH_PORT=22
set "SSH_DIR=%USERPROFILE%\.ssh"
set "SSH_KEY_PATH=%USERPROFILE%\.ssh\id_ed25519"

REM ===========================================
REM User Input
REM ===========================================
echo Enter SSH connection information (Press Enter for default values):
echo.

set /p "SSH_HOST=SSH Host [%DEFAULT_SSH_HOST%]: "
if "%SSH_HOST%"=="" set "SSH_HOST=%DEFAULT_SSH_HOST%"

set /p "SSH_USER=SSH User [%DEFAULT_SSH_USER%]: "
if "%SSH_USER%"=="" set "SSH_USER=%DEFAULT_SSH_USER%"

set /p "SSH_PORT=SSH Port [%DEFAULT_SSH_PORT%]: "
if "%SSH_PORT%"=="" set "SSH_PORT=%DEFAULT_SSH_PORT%"

echo.
echo ===========================================
echo Target: %SSH_USER%@%SSH_HOST%:%SSH_PORT%
echo Key Path: %SSH_KEY_PATH%
echo ===========================================
echo.

REM ===========================================
REM Step 1: Check/Create SSH Key
REM ===========================================
echo [1/4] Checking SSH key...

if not exist "%SSH_DIR%" (
    echo Creating .ssh directory...
    mkdir "%SSH_DIR%"
)

if exist "%SSH_KEY_PATH%" (
    echo SSH key already exists: %SSH_KEY_PATH%
    echo Using existing key.
    goto :STEP2
)

echo Generating new SSH key...
echo.
echo Press Enter 3 times when prompted:
echo   1. File location - press Enter for default
echo   2. Passphrase - press Enter for no passphrase
echo   3. Confirm passphrase - press Enter again
echo.

ssh-keygen -t ed25519 -f "%SSH_KEY_PATH%"
if errorlevel 1 (
    echo [ERROR] Failed to generate SSH key.
    pause
    exit /b 1
)
echo.
echo SSH key generated successfully.

:STEP2

echo.

REM ===========================================
REM Step 2: Display Public Key
REM ===========================================
echo [2/4] Your public key:
echo ===========================================
type "%SSH_KEY_PATH%.pub"
echo ===========================================
echo.

REM ===========================================
REM Step 3: Register Public Key on Server
REM ===========================================
echo [3/4] Registering public key on server...
echo.
echo This will require your SSH password ONE TIME.
echo After this, password-less login will be enabled.
echo.

set /p "REGISTER=Register public key on server? (Y/N) [Y]: "
if "%REGISTER%" == "" set REGISTER=Y

if /i "%REGISTER%" == "Y" (
    echo.
    echo Connecting to server and registering key...
    echo Please enter your password when prompted:
    echo.
    
    REM Create remote .ssh directory and add public key
    type "%SSH_KEY_PATH%.pub" | ssh -p %SSH_PORT% %SSH_USER%@%SSH_HOST% "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
    
    if errorlevel 1 (
        echo.
        echo [WARNING] Key registration may have failed.
        echo Please try registering manually.
    ) else (
        echo.
        echo Public key registered successfully!
    )
) else (
    echo Skipping key registration.
    echo You can register manually later.
)

echo.

REM ===========================================
REM Step 4: Connection Test
REM ===========================================
echo [4/4] Testing SSH connection with key authentication...
echo.

ssh -i "%SSH_KEY_PATH%" -p %SSH_PORT% -o BatchMode=yes -o ConnectTimeout=10 %SSH_USER%@%SSH_HOST% "echo 'SSH key authentication successful!'"

if errorlevel 1 (
    echo.
    echo [WARNING] Key authentication test failed.
    echo Possible causes:
    echo   - Key not registered on server
    echo   - Server configuration issue
    echo   - Network problem
    echo.
    echo Try connecting manually:
    echo   ssh -i "%SSH_KEY_PATH%" %SSH_USER%@%SSH_HOST%
) else (
    echo.
    echo ====================================
    echo    SSH Key Setup Complete!
    echo ====================================
    echo.
    echo You can now use password-less SSH authentication.
    echo.
    
    REM Update upload-to-server.bat
    echo Would you like to update upload-to-server.bat to use this key by default?
    set /p "UPDATE_SCRIPT=Update script? (Y/N) [Y]: "
    if "!UPDATE_SCRIPT!" == "" set UPDATE_SCRIPT=Y
    
    if /i "!UPDATE_SCRIPT!" == "Y" (
        echo.
        echo Updating upload-to-server.bat...
        
        REM Create a temporary PowerShell script to update the file
        echo $content = Get-Content -Path 'upload-to-server.bat' -Raw > "%TEMP%\update_bat.ps1"
        echo $newKeyPath = '%SSH_KEY_PATH%' -replace '\\', '\\' >> "%TEMP%\update_bat.ps1"
        echo $content = $content -replace 'set DEFAULT_SSH_KEY_FILE=', "set DEFAULT_SSH_KEY_FILE=$newKeyPath`nREM OLD: set DEFAULT_SSH_KEY_FILE=" >> "%TEMP%\update_bat.ps1"
        echo Set-Content -Path 'upload-to-server.bat' -Value $content >> "%TEMP%\update_bat.ps1"
        
        powershell -ExecutionPolicy Bypass -File "%TEMP%\update_bat.ps1"
        del "%TEMP%\update_bat.ps1"
        
        echo Done! upload-to-server.bat has been updated.
        echo DEFAULT_SSH_KEY_FILE is now set to: %SSH_KEY_PATH%
    )
)

echo.
echo ===========================================
echo Summary:
echo   SSH Key: %SSH_KEY_PATH%
echo   Server: %SSH_USER%@%SSH_HOST%
echo ===========================================
echo.
echo Press any key to exit...
pause >nul
