param(
    [string]$OutputPath = "",
    [switch]$SkipFrontendBuild,
    # Include the vendor directory so the web installer works without SSH/Composer
    [switch]$IncludeVendor
)

$ErrorActionPreference = 'Stop'

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$ReleaseDir = Join-Path $RootDir "deploy\releases"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $Suffix = if ($IncludeVendor) { "with-vendor" } else { "no-vendor" }
    $OutputPath = Join-Path $ReleaseDir "memories-map-cpanel-$Suffix-$Timestamp.zip"
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath) | Out-Null

if (-not $SkipFrontendBuild) {
    Write-Host "--> Building frontend assets"
    Push-Location (Join-Path $RootDir "frontend")
    try {
        npm.cmd ci
        npm.cmd run build
    }
    finally {
        Pop-Location
    }
}

$StageRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("memories-map-release-" + [System.Guid]::NewGuid().ToString("N"))
$PackageRoot = Join-Path $StageRoot "memories-map"
New-Item -ItemType Directory -Force -Path $PackageRoot | Out-Null

Write-Host "--> Staging release package"
New-Item -ItemType Directory -Force -Path (Join-Path $PackageRoot "backend") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $PackageRoot "frontend") | Out-Null

# Use robocopy to avoid copying huge dependency folders into the staging area.
robocopy (Join-Path $RootDir "backend") (Join-Path $PackageRoot "backend") /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP /XD vendor storage\\logs storage\\framework\\cache storage\\framework\\sessions storage\\framework\\views | Out-Null
robocopy (Join-Path $RootDir "frontend") (Join-Path $PackageRoot "frontend") /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP /XD node_modules | Out-Null
Copy-Item -Recurse -Force (Join-Path $RootDir "deploy") (Join-Path $PackageRoot "deploy")
Copy-Item -Force (Join-Path $RootDir "README.md") (Join-Path $PackageRoot "README.md")

# Vendor directory handling
if ($IncludeVendor) {
    Write-Host "--> Copying vendor directory (this may take a minute)"
    robocopy (Join-Path $RootDir "backend\vendor") (Join-Path $PackageRoot "backend\vendor") /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
}
else {
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $PackageRoot "backend\vendor")
}

Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $PackageRoot "frontend\node_modules")
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $PackageRoot "backend\storage\logs\*")
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $PackageRoot "backend\storage\framework\cache\*")
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $PackageRoot "backend\storage\framework\sessions\*")
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $PackageRoot "backend\storage\framework\views\*")

if ($IncludeVendor) {
    @"
QUICK INSTALL (Web Installer — no SSH needed)
=============================================
1. In cPanel File Manager, upload and extract this archive to your home directory
   (e.g. /home/YOURUSER/memories-map). Do NOT extract inside public_html.
2. Upload deploy/cpanel/memories-map-installer.php to your public_html directory.
3. Visit https://your-domain.com/memories-map-installer.php in your browser.
4. Follow the on-screen wizard. The installer configures everything for you.
5. DELETE the installer files from public_html when complete (the wizard will remind you).

Full guide: deploy/CPANEL_SOFTACULOUS_INSTALL.md
"@ | Set-Content -Path (Join-Path $PackageRoot "INSTALL_ON_CPANEL.txt") -Encoding ASCII
}
else {
    @"
INSTALL (SSH/Composer required)
================================
1. Upload and extract this archive in your cPanel home directory (not inside public_html).
2. Copy backend/.env.example to backend/.env and configure APP_URL + DB credentials.
3. Run: bash deploy/cpanel/post_install.sh
4. If document root cannot point to backend/public, run:
   PUBLIC_HTML_DIR=/home/CPANEL_USER/public_html BACKEND_DIR=/home/CPANEL_USER/memories-map/backend bash deploy/cpanel/publish_public_html.sh
5. Full guide: deploy/CPANEL_SOFTACULOUS_INSTALL.md

NOTE: For a no-SSH install, use the -IncludeVendor build with the web installer.
"@ | Set-Content -Path (Join-Path $PackageRoot "INSTALL_ON_CPANEL.txt") -Encoding ASCII
}

if (Test-Path $OutputPath) {
    Remove-Item -Force $OutputPath
}

Write-Host "--> Creating zip archive"
Compress-Archive -Path (Join-Path $StageRoot "memories-map") -DestinationPath $OutputPath
Remove-Item -Recurse -Force $StageRoot

Write-Host "==> Release archive created"
Write-Host $OutputPath
