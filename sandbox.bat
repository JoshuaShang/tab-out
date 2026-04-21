@echo off
:: Tab Out — Sandbox Launcher
:: Launches Chrome with an isolated profile and the extension pre-loaded.
:: Your real Chrome profile is NOT affected.

set SCRIPT_DIR=%~dp0
set EXTENSION_DIR=%SCRIPT_DIR%extension
set PROFILE_DIR=%SCRIPT_DIR%sandbox-profile

:: Find Chrome
set CHROME=
for %%p in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
) do (
  if exist %%p set CHROME=%%p
)

if not defined CHROME (
  echo Chrome not found. Please install Google Chrome and try again.
  pause
  exit /b 1
)

echo Starting Tab Out sandbox...
echo Profile: %PROFILE_DIR%
echo Extension: %EXTENSION_DIR%
echo.

start "" %CHROME% ^
  --user-data-dir="%PROFILE_DIR%" ^
  --load-extension="%EXTENSION_DIR%" ^
  --new-tab

echo Chrome launched. Open a new tab to see Tab Out.
