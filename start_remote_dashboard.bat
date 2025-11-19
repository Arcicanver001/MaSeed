@echo off
setlocal

REM Determine the directory of this script
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

set "SERVER_DIR=%SCRIPT_DIR%server"
set "SERVER_LAUNCHER=%SERVER_DIR%\run_server_console.bat"

REM Check if Node.js is available before spawning the server window
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not on PATH.
    echo Please install Node.js before running this shortcut.
    pause
    exit /b 1
)

if not exist "%SERVER_DIR%\server.js" (
    echo ERROR: Could not find server.js in "%SERVER_DIR%".
    pause
    exit /b 1
)

if not exist "%SERVER_LAUNCHER%" (
    echo ERROR: Missing helper script "%SERVER_LAUNCHER%".
    pause
    exit /b 1
)

echo Launching Smart Greenhouse server in a new window...
start "Smart Greenhouse Server" "%COMSPEC%" /k ""%SERVER_LAUNCHER%""

REM Give the servers time to start, then open the dashboard
timeout /t 3 /nobreak >nul

set "LOGIN_PAGE=%SCRIPT_DIR%login.html"
if exist "%LOGIN_PAGE%" (
    start "" "%LOGIN_PAGE%"
) else (
    start "" "http://localhost:8000/login.html"
)

echo.
echo Servers are running in the other window. Close this window if you wish.
pause
endlocal

