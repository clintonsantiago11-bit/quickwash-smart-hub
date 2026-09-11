# =============================================================
# QuickWash Smart Hub - Quality Gate
# Runs backend tests + frontend type check + lint + build.
# Usage:  powershell -ExecutionPolicy Bypass -File run-gate.ps1
# Exit code 0 = all green.
# =============================================================
$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
$php  = 'C:\xampp\php\php.exe'
$failed = $false

function Check-Step([string]$name, [scriptblock]$body) {
    Write-Host "`n==> $name" -ForegroundColor Cyan
    try { & $body } catch { Write-Host "EXCEPTION: $_" -ForegroundColor Red; $script:failed = $true }
}

# --- Backend: PHPUnit (dedicated test DB, does NOT touch live data) ---
Check-Step 'Backend tests (PHPUnit)' {
    Push-Location "$root\backend"
    & $php vendor\bin\phpunit
    if ($LASTEXITCODE -ne 0) { $script:failed = $true }
    Pop-Location
}

# --- Frontend: TypeScript type check ---
Check-Step 'Frontend type check (tsc --noEmit)' {
    Push-Location "$root\frontend"
    & npx tsc --noEmit
    if ($LASTEXITCODE -ne 0) { $script:failed = $true }
    Pop-Location
}

# --- Frontend: lint ---
Check-Step 'Frontend lint (eslint)' {
    Push-Location "$root\frontend"
    & npx eslint .
    if ($LASTEXITCODE -ne 0) { $script:failed = $true }
    Pop-Location
}

Write-Host "`n========================================="
if ($failed) {
    Write-Host 'GATE: FAILED - fix the issues above.' -ForegroundColor Red
    exit 1
} else {
    Write-Host 'GATE: ALL GREEN' -ForegroundColor Green
    exit 0
}
