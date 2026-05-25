<#
.SYNOPSIS
    Memories Map versioned release automation script.

.DESCRIPTION
    1. Bumps the patch segment of the version in frontend/package.json (e.g. 0.0.3.0 -> 0.0.4.0).
    2. Validates the frontend build + ESLint inside Docker (unless -SkipBuild).
    3. Creates a release zip at deploy/releases/<YYYY-DD-MM>-Memories_Map_<Version>.zip.
    4. Git commits all staged changes with the supplied message.
    5. Pushes to origin (unless -SkipPush).

.PARAMETER CommitMessage
    The git commit message to use. Required.

.PARAMETER SkipBuild
    Skip the Docker build/lint validation step.

.PARAMETER SkipPush
    Commit locally but do not push to origin.

.EXAMPLE
    .\release.ps1 -CommitMessage "WS-E R01: search and command palette"
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$CommitMessage,

    [switch]$SkipBuild,

    [switch]$SkipPush
)

$ErrorActionPreference = 'Stop'

$RootDir    = (Resolve-Path (Join-Path $PSScriptRoot "..\.." )).Path
$PkgJson    = Join-Path $RootDir "frontend\package.json"
$ReleaseDir = Join-Path $RootDir "deploy\releases"

# 1. Read current version
$pkgContent = Get-Content $PkgJson -Raw | ConvertFrom-Json
$currentVersion = $pkgContent.version
Write-Host "Current version : $currentVersion"

# Parse as major.minor.patch.build (e.g. 0.0.3.0)
$parts = $currentVersion -split '\.'
if ($parts.Count -ne 4) {
    throw "Unexpected version format '$currentVersion'. Expected major.minor.patch.build (e.g. 0.0.3.0)."
}

# Bump the patch segment (index 2)
$parts[2] = [int]$parts[2] + 1
$newVersion = $parts -join '.'
Write-Host "New version     : $newVersion"

# 2. Write new version to package.json
$rawJson = Get-Content $PkgJson -Raw
$rawJson = $rawJson -replace ([regex]::Escape('"version": "' + $currentVersion + '"')), ('"version": "' + $newVersion + '"')
[System.IO.File]::WriteAllText($PkgJson, $rawJson, [System.Text.Encoding]::UTF8)
Write-Host "--> frontend/package.json updated to $newVersion"

# 3. Docker build + lint validation
if (-not $SkipBuild) {
    Write-Host "--> Running Docker build + ESLint validation"
    Push-Location $RootDir
    try {
        docker compose exec frontend sh -lc "npm run build && npx eslint src --ext ts,tsx --max-warnings 0"
        if ($LASTEXITCODE -ne 0) {
            throw "Build/lint FAILED (exit $LASTEXITCODE). Release aborted."
        }
    }
    finally {
        Pop-Location
    }
    Write-Host "--> Build + lint: PASSED"
} else {
    Write-Host "--> SkipBuild flag set - skipping Docker validation"
}

# 4. Create release zip
# Date in YYYY-DD-MM format (year-day-month, as specified)
$datePart = Get-Date -Format "yyyy-dd-MM"
$zipName  = "${datePart}-Memories_Map_${newVersion}.zip"
$zipPath  = Join-Path $ReleaseDir $zipName

Write-Host "--> Creating release archive: $zipName"
& (Join-Path $PSScriptRoot "create_release_zip.ps1") -IncludeVendor -SkipFrontendBuild -OutputPath $zipPath

if (-not (Test-Path $zipPath)) {
    throw "Release zip not created at '$zipPath'. Release aborted."
}
Write-Host "--> Archive created: $zipPath"

# 5. Git commit
Push-Location $RootDir
try {
    Write-Host "--> Staging all changes for commit"
    git add -A
    git commit -m $CommitMessage
    if ($LASTEXITCODE -ne 0) {
        throw "git commit failed with exit code $LASTEXITCODE."
    }
    Write-Host "--> Committed: $CommitMessage"

    if (-not $SkipPush) {
        Write-Host "--> Pushing to origin"
        git push
        if ($LASTEXITCODE -ne 0) {
            throw "git push failed with exit code $LASTEXITCODE."
        }
        Write-Host "--> Push complete"
    } else {
        Write-Host "--> SkipPush flag set - skipping git push"
    }
}
finally {
    Pop-Location
}

Write-Host "Release $newVersion complete. Archive: $zipPath"