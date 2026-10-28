$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force artifacts | Out-Null
$installer = Get-ChildItem 'src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe' | Select-Object -First 1
if (!$installer -or $installer.Length -lt 1000000) { throw 'Windows installer absent or too small' }
$install = Start-Process $installer.FullName -ArgumentList '/S' -PassThru -Wait
if ($install.ExitCode -ne 0) { throw "Installer failed: $($install.ExitCode)" }
$exe = Get-ChildItem "$env:LOCALAPPDATA/Solar" -Filter 'solar.exe' -Recurse | Select-Object -First 1
if (!$exe) { throw 'Installed executable absent' }
$process = Start-Process $exe.FullName -PassThru
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
  @{version='0.14.0';architecture='x64';installed=$true;window=$true;startupSurvived=$true;microphone='Requires manual hardware validation';oauth='Requires user credentials';signed=$false} | ConvertTo-Json | Set-Content artifacts/windows-verification.json
} finally { if (!$process.HasExited) { Stop-Process -Id $process.Id -Force } }
Copy-Item $installer.FullName artifacts/Solar-0.14.0-Windows-x64-setup.exe
$hash=(Get-FileHash artifacts/Solar-0.14.0-Windows-x64-setup.exe -Algorithm SHA256).Hash.ToLower()
"$hash  Solar-0.14.0-Windows-x64-setup.exe" | Set-Content artifacts/SHA256SUMS-Windows.txt
