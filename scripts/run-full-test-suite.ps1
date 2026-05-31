$ErrorActionPreference = 'Stop'

function Resolve-PhpExe {
    $phpCommand = Get-Command php -ErrorAction SilentlyContinue
    if ($phpCommand) {
        return $phpCommand.Source
    }

    $wingetPhp = 'C:\Users\mike\AppData\Local\Microsoft\WinGet\Packages\PHP.PHP.8.2_Microsoft.Winget.Source_8wekyb3d8bbwe\php.exe'
    if (Test-Path $wingetPhp) {
        return $wingetPhp
    }

    throw 'PHP executable not found. Install PHP first or ensure php is on PATH.'
}

$phpExe = Resolve-PhpExe
$sqlitePath = (Resolve-Path '.\backend\database').Path + '\testing.sqlite'
if (-not (Test-Path $sqlitePath)) {
    New-Item $sqlitePath -ItemType File | Out-Null
}

$env:DB_CONNECTION = 'sqlite'
$env:DB_DATABASE = $sqlitePath

Write-Host 'Running backend feature+unit tests...'
& $phpExe .\backend\artisan migrate:fresh --force
& $phpExe .\backend\artisan test

Write-Host 'Running frontend unit tests with coverage...'
npm.cmd --prefix frontend run test:coverage

Write-Host 'Running frontend WCAG 2.2 AAA accessibility suite...'
npm.cmd --prefix frontend run a11y:test

Write-Host 'Full platform suite completed.'
