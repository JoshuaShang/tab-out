# Tab Out — Sandbox Launcher (PowerShell)
# Launches Chrome with an isolated profile and the extension pre-loaded.
# Your real Chrome profile is NOT affected.

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$ExtensionDir = Join-Path $ScriptDir "extension"
$ProfileDir   = Join-Path $ScriptDir "sandbox-profile"

# Find Chrome
$ChromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
)

$Chrome = $ChromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $Chrome) {
    Write-Error "Chrome not found. Please install Google Chrome."
    exit 1
}

Write-Host "Starting Tab Out sandbox..."
Write-Host "Profile : $ProfileDir"
Write-Host "Extension: $ExtensionDir"
Write-Host ""

Start-Process $Chrome -ArgumentList @(
    "--user-data-dir=`"$ProfileDir`"",
    "--load-extension=`"$ExtensionDir`"",
    "--new-tab"
)

Write-Host "Chrome launched. Open a new tab to see Tab Out."
