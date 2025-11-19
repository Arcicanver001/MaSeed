@echo off
setlocal

REM Always run from the directory where this helper script resides
set "SCRIPT_DIR=%~dp0"
echo cd /d "%SCRIPT_DIR%"
cd /d "%SCRIPT_DIR%"

echo node server.js
echo.
node server.js
if errorlevel 1 (
    echo.
    echo ERROR: Failed to start server.js. Exit code: %errorlevel%
    pause
)

endlocal

