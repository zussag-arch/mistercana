$ErrorActionPreference = "Stop"

$mistercana = "C:\Users\Gabriele\Documents\GitHub\mistercana"
$flda = "C:\Users\Gabriele\Documents\GitHub\fantalab-data-agent"

$fldaExe = Join-Path $flda ".venv\Scripts\flda.exe"

Write-Host "Avvio ambiente locale Mistercana..." -ForegroundColor Cyan

# FLDA
$port8765 = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue

if (-not $port8765) {
    if (-not (Test-Path $fldaExe)) {
        Write-Host "FLDA non trovato: $fldaExe" -ForegroundColor Red
        exit 1
    }

    Write-Host "Avvio FLDA..." -ForegroundColor Green

    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location '$flda'; & '$fldaExe' serve"
    )
}
else {
    Write-Host "FLDA gia attivo sulla porta 8765." -ForegroundColor Yellow
}

Start-Sleep -Seconds 2

# Mistercana / Vite
$port5173 = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue

if (-not $port5173) {
    Write-Host "Avvio Mistercana..." -ForegroundColor Green

    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location '$mistercana'; npm run dev"
    )
}
else {
    Write-Host "Mistercana gia attivo sulla porta 5173." -ForegroundColor Yellow
}

Start-Sleep -Seconds 3

Write-Host "Apro localhost..." -ForegroundColor Green
Start-Process "http://localhost:5173"