#!/usr/bin/env pwsh
# ─────────────────────────────────────────────────────────────
#  Pulse Task Management — Local Dev Startup Script
#  Run from the project root: .\START_LOCAL.ps1
# ─────────────────────────────────────────────────────────────

Write-Host "`n=== Pulse Local Dev Startup ===" -ForegroundColor Cyan

# 1. Start PostgreSQL via Docker Compose
Write-Host "`n[1/4] Starting PostgreSQL (Docker)..." -ForegroundColor Yellow
Set-Location "apps\api"
docker compose up -d
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: Docker not running or not installed. Please start Docker Desktop first." -ForegroundColor Red
  exit 1
}
Write-Host "PostgreSQL is up on port 5432" -ForegroundColor Green
Set-Location "..\..";

# 2. Install deps if needed
Write-Host "`n[2/4] Checking node_modules..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
  Write-Host "Installing workspace dependencies..."
  npm install
}

# 3. Run Prisma migrations + generate
Write-Host "`n[3/4] Running Prisma migrate dev..." -ForegroundColor Yellow
Set-Location "apps\api"
# Wait a moment for Postgres to be fully ready
Start-Sleep -Seconds 3
npx prisma migrate dev --name init 2>&1 | Tail-ErrorLines
npx prisma generate
Set-Location "..\..";

# 4. Start API + Web in parallel
Write-Host "`n[4/4] Starting API (port 3000) and Web (port 5173)..." -ForegroundColor Yellow
Write-Host "API  → http://localhost:3000" -ForegroundColor Cyan
Write-Host "Web  → http://localhost:5173" -ForegroundColor Cyan
Write-Host "Docs → http://localhost:3000/api/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "Login with: dev provider + any email (see LoginPage)" -ForegroundColor Green
Write-Host "Admin: sujeeth.k@econz.net (auto-gets Admin role)" -ForegroundColor Green
Write-Host ""

# Run both in parallel using background jobs
$apiJob = Start-Job -ScriptBlock {
  Set-Location "c:\Projects\Task Management\apps\api"
  npm run start:dev
} -Name "API"

$webJob = Start-Job -ScriptBlock {
  Set-Location "c:\Projects\Task Management\apps\web"
  npm run dev
} -Name "Web"

Write-Host "Both services started as background jobs. Streaming output..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop both.`n" -ForegroundColor Yellow

try {
  while ($true) {
    Receive-Job $apiJob -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "[API] $_" -ForegroundColor DarkCyan }
    Receive-Job $webJob -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "[WEB] $_" -ForegroundColor DarkGreen }
    Start-Sleep -Milliseconds 500
  }
} finally {
  Stop-Job $apiJob, $webJob
  Remove-Job $apiJob, $webJob
  Write-Host "`nShutdown complete." -ForegroundColor Red
}
