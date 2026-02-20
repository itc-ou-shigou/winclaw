@echo off
echo === WinClawUI EXE Replacement Script ===
echo.
echo Step 1: Killing WinClawUI...
taskkill /IM WinClawUI.exe /F 2>nul
timeout /t 2 /nobreak >nul

echo Step 2: Copying new exe...
copy /Y "C:\work\winclaw\apps\windows\WinClawUI\bin\PublishFinal\WinClawUI.exe" "C:\Program Files\WinClaw\WinClawUI.exe"
if errorlevel 1 (
    echo ERROR: Failed to copy. Run this script as Administrator!
    pause
    exit /b 1
)

echo Step 3: Starting new WinClawUI...
start "" "C:\Program Files\WinClaw\WinClawUI.exe"

echo.
echo === Done! New WinClawUI is running. ===
pause
