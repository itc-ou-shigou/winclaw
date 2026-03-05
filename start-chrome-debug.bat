@echo off
echo ============================================
echo  Chrome Debug Mode - Default Profile
echo ============================================
echo.

:: Kill ALL chrome processes first
echo Killing all Chrome processes...
taskkill /F /IM chrome.exe >nul 2>&1
timeout /t 3 /nobreak >nul

:: Double check
taskkill /F /IM chrome.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo Starting Chrome with debug port 9222 (default profile)...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --remote-allow-origins=*

echo Waiting 5 seconds...
timeout /t 5 /nobreak >nul

echo Checking port 9222...
powershell -ExecutionPolicy Bypass -File "C:\work\winclaw\check-port.ps1"
echo.
pause
