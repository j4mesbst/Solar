$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force artifacts | Out-Null
$installer = Get-ChildItem 'src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe' | Select-Object -First 1
if (!$installer -or $installer.Length -lt 1000000) { throw 'Windows installer absent or too small' }
$install = Start-Process $installer.FullName -ArgumentList '/S' -PassThru -Wait
if ($install.ExitCode -ne 0) { throw "Installer failed: $($install.ExitCode)" }
$exe = Get-ChildItem "$env:LOCALAPPDATA/Solar" -Filter 'solar.exe' -Recurse | Select-Object -First 1
if (!$exe) { throw 'Installed executable absent' }
# Test process only; no registry change and no debug endpoint in the distributed app.
$priorFlags = $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9222 --remote-debugging-address=127.0.0.1'
$process = Start-Process $exe.FullName -PassThru
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = $priorFlags
try {
  $window = $null
  for ($i=0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    $process.Refresh()
    if ($process.HasExited) { throw 'Solar exited during startup' }
    if ($process.MainWindowHandle -ne 0 -and $process.MainWindowTitle -eq 'Solar') { $window=$process.MainWindowHandle; break }
  }
  if (!$window) { throw 'No native Solar window appeared' }
  Start-Sleep -Seconds 8
  $process.Refresh()
  if ($process.HasExited) { throw 'Solar exited after creating its window' }
  node scripts/windows-webview-smoke.cjs
  if ($LASTEXITCODE -ne 0) { throw 'Installed WebView2 validation failed' }
  @{version='0.15.0';architecture='x64';installed=$true;window=$true;startupSurvived=$true;microphone='Requires manual hardware validation';oauth='Requires user credentials';signed=$false} | ConvertTo-Json | Set-Content artifacts/windows-verification.json
} finally { if (!$process.HasExited) { Stop-Process -Id $process.Id -Force } }
Copy-Item $installer.FullName artifacts/Solar-0.15.0-Windows-x64-setup.exe
$hash=(Get-FileHash artifacts/Solar-0.15.0-Windows-x64-setup.exe -Algorithm SHA256).Hash.ToLower()
"$hash  Solar-0.15.0-Windows-x64-setup.exe" | Set-Content artifacts/SHA256SUMS-Windows.txt
