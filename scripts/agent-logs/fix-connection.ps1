# PowerShell script to diagnose and fix database connection issues

Write-Host "`n=== Database Connection Fix Utility ===`n" -ForegroundColor Cyan

# Check Docker container
Write-Host "Checking Docker container..." -ForegroundColor Yellow
$containerStatus = docker inspect atlas_db --format "{{.State.Running}}" 2>$null

if ($containerStatus -ne "true") {
    Write-Host "✗ Container not running. Starting..." -ForegroundColor Red
    Set-Location ..\..
    docker-compose up -d postgres
    Start-Sleep -Seconds 3
    Set-Location scripts\agent-logs
}

# Get actual environment variables from container
Write-Host "`nGetting database credentials from Docker container..." -ForegroundColor Yellow
$dbUser = docker exec atlas_db printenv POSTGRES_USER 2>$null
$dbPassword = docker exec atlas_db printenv POSTGRES_PASSWORD 2>$null
$dbName = docker exec atlas_db printenv POSTGRES_DB 2>$null

if (-not $dbUser) {
    Write-Host "✗ Could not read environment from container" -ForegroundColor Red
    Write-Host "`nTrying to read from project .env..." -ForegroundColor Yellow

    $envFile = "..\..\\.env"
    if (Test-Path $envFile) {
        Get-Content $envFile | ForEach-Object {
            if ($_ -match '^POSTGRES_USER=(.*)$') { $dbUser = $matches[1] }
            if ($_ -match '^POSTGRES_PWD=(.*)$') { $dbPassword = $matches[1] }
        }
        $dbName = "atlas"
    }
}

Write-Host "`nDetected credentials:" -ForegroundColor Cyan
Write-Host "  Database: $dbName" -ForegroundColor White
Write-Host "  User: $dbUser" -ForegroundColor White
Write-Host "  Password: $($dbPassword -replace '.', '*')" -ForegroundColor White

# Test connection from within container
Write-Host "`nTesting connection from within container..." -ForegroundColor Yellow
$testResult = docker exec atlas_db psql -U $dbUser -d $dbName -c "SELECT version();" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Container connection works!" -ForegroundColor Green
} else {
    Write-Host "✗ Container connection failed: $testResult" -ForegroundColor Red

    # Try to list available databases
    Write-Host "`nListing available databases..." -ForegroundColor Yellow
    $databases = docker exec atlas_db psql -U $dbUser -d postgres -t -c "SELECT datname FROM pg_database WHERE datistemplate = false;" 2>&1
    Write-Host "Available databases: $databases" -ForegroundColor White

    # Try to connect to postgres database
    if ($databases -notmatch "atlas") {
        Write-Host "`nDatabase 'atlas' not found. Creating..." -ForegroundColor Yellow
        docker exec atlas_db psql -U $dbUser -d postgres -c "CREATE DATABASE atlas;"
    }
}

# Test if table exists
Write-Host "`nChecking if agent_tool_invocation_log table exists..." -ForegroundColor Yellow
$tableCheck = docker exec atlas_db psql -U $dbUser -d $dbName -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'agent_tool_invocation_log');" 2>&1

if ($tableCheck -match "t") {
    Write-Host "✓ Table exists!" -ForegroundColor Green

    # Get row count
    $count = docker exec atlas_db psql -U $dbUser -d $dbName -t -c "SELECT COUNT(*) FROM agent_tool_invocation_log;" 2>&1
    Write-Host "  Rows: $($count.Trim())" -ForegroundColor White
} else {
    Write-Host "✗ Table doesn't exist yet" -ForegroundColor Red
    Write-Host "  This is normal if you haven't used the agent yet" -ForegroundColor Yellow
    Write-Host "  The table will be created by Liquibase when the API starts" -ForegroundColor Yellow
}

# Create/update .env file
Write-Host "`nUpdating local .env file..." -ForegroundColor Yellow
$envContent = @"
# Database Configuration
# Auto-detected from Docker container

DB_HOST=localhost
DB_PORT=5432
DB_NAME=$dbName
DB_USER=$dbUser
DB_PASSWORD=$dbPassword
"@

Set-Content -Path ".env" -Value $envContent
Write-Host "✓ Updated .env file" -ForegroundColor Green

# Test connection from host
Write-Host "`nTesting connection from host (localhost)..." -ForegroundColor Yellow
$env:DB_HOST = "localhost"
$env:DB_PORT = "5432"
$env:DB_NAME = $dbName
$env:DB_USER = $dbUser
$env:DB_PASSWORD = $dbPassword

python test-connection.py

Write-Host "`n=== Diagnostics Complete ===" -ForegroundColor Green
Write-Host "`nIf the test failed, try:" -ForegroundColor Yellow
Write-Host "1. Restart PostgreSQL container:" -ForegroundColor White
Write-Host "   docker-compose restart postgres" -ForegroundColor Cyan
Write-Host "`n2. Check PostgreSQL logs:" -ForegroundColor White
Write-Host "   docker logs atlas_db --tail 50" -ForegroundColor Cyan
Write-Host "`n3. Connect directly to verify credentials:" -ForegroundColor White
Write-Host "   docker exec -it atlas_db psql -U $dbUser -d $dbName" -ForegroundColor Cyan
