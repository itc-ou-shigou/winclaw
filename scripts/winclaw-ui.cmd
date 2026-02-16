@echo off
setlocal enabledelayedexpansion

rem WinClaw UI Launcher
rem Starts Gateway (if not running) and opens Control UI in browser

set "WINCLAW_DIR=%~dp0"
set "WINCLAW_NODE=%WINCLAW_DIR%node\node.exe"
set "WINCLAW_APP=%WINCLAW_DIR%app\winclaw.mjs"
set "GATEWAY_PORT=18789"
set "GATEWAY_URL=http://127.0.0.1:%GATEWAY_PORT%/"

rem Check if first-run setup is needed (no config or gateway.mode missing)
"%WINCLAW_NODE%" -e "const fs=require('fs'),p=require('path').join(require('os').homedir(),'.winclaw','winclaw.json');try{const c=JSON.parse(fs.readFileSync(p,'utf8'));if(!c.gateway||!c.gateway.mode){process.exit(1)}else{process.exit(0)}}catch{process.exit(1)}" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo First-run setup required. Starting setup wizard...
    "%WINCLAW_NODE%" "%WINCLAW_APP%" onboard --flow quickstart
)

rem Check if gateway port is already listening
netstat -ano 2>nul | findstr ":%GATEWAY_PORT% " | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    goto :open_browser
)

rem Start gateway in background (minimized window)
start "WinClaw Gateway" /min "%WINCLAW_NODE%" "%WINCLAW_APP%" gateway

rem Wait for gateway to become ready (up to 15 seconds)
for /L %%i in (1,1,15) do (
    timeout /t 1 /nobreak >nul
    netstat -ano 2>nul | findstr ":%GATEWAY_PORT% " | findstr "LISTENING" >nul 2>&1
    if !ERRORLEVEL! equ 0 goto :open_browser
)

:open_browser
start "" "%GATEWAY_URL%"
