# PowerShell script to check database credentials and connectivity

Write-Host "`n=== Database Connection Diagnostics ===`n" -ForegroundColor Cyan

# Check if Docker container is running
Write-Host "1. Checking Docker container status..." -ForegroundColor Yellow
$container = docker ps --filter "name=atlas_db" --format "{{.Names}}: {{.Status}}"
if ($container) {
    Write-Host "   ✓ Container running: $container" -ForegroundColor Green
} else {
    Write-Host "   ✗ Container not running" -ForegroundColor Red
    Write-Host "   Run: docker-compose up -d postgres" -ForegroundColor Yellow
    exit 1
}

# Load .env from project root
Write-Host "`n2. Loading credentials from project .env..." -ForegroundColor Yellow
$envFile = "..\..\\.env"
if (Test-Path $envFile) {
    $envVars = @{}
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            $envVars[$name] = $value
        }
    }
    Write-Host "   POSTGRES_USER: $($envVars['POSTGRES_USER'])" -ForegroundColor White
    Write-Host "   POSTGRES_PWD: $($envVars['POSTGRES_PWD'])" -ForegroundColor White
} else {
    Write-Host "   ✗ .env file not found at $envFile" -ForegroundColor Red
    exit 1
}

# Test connection using docker exec
Write-Host "`n3. Testing connection using docker exec..." -ForegroundColor Yellow
$testQuery = "SELECT COUNT(*) FROM agent_tool_invocation_log;"
$result = docker exec atlas_db psql -U $($envVars['POSTGRES_USER']) -d atlas -c $testQuery 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ Connection successful!" -ForegroundColor Green
    Write-Host "   Result: $result" -ForegroundColor White

    # Test if table exists
    Write-Host "`n4. Checking agent_tool_invocation_log table..." -ForegroundColor Yellow
    $countQuery = "SELECT COUNT(*) FROM agent_tool_invocation_log;"
    $count = docker exec atlas_db psql -U $($envVars['POSTGRES_USER']) -d atlas -t -c $countQuery
    Write-Host "   ✓ Found $($count.Trim()) log entries" -ForegroundColor Green

    # Get port mapping
    Write-Host "`n5. Checking port mapping..." -ForegroundColor Yellow
    $port = docker port atlas_db 5432
    Write-Host "   PostgreSQL port: $port" -ForegroundColor White

    # Update local .env with correct credentials
    Write-Host "`n6. Updating local .env file..." -ForegroundColor Yellow
    $localEnv = @"
# Database Configuration for Agent Log Utilities
# Auto-generated from project .env

DB_HOST=localhost
DB_PORT=5432
DB_NAME=atlas
DB_USER=$($envVars['POSTGRES_USER'])
DB_PASSWORD=$($envVars['POSTGRES_PWD'])
"@
    Set-Content -Path ".env" -Value $localEnv
    Write-Host "   ✓ Updated .env with correct credentials" -ForegroundColor Green

    Write-Host "`n=== Configuration Complete! ===" -ForegroundColor Green
    Write-Host "`nYou can now run:" -ForegroundColor Cyan
    Write-Host "  python test-connection.py" -ForegroundColor White
    Write-Host "  python analyze-logs.py --report-type summary" -ForegroundColor White

} else {
    Write-Host "   ✗ Connection failed: $result" -ForegroundColor Red
    Write-Host "`n   Possible issues:" -ForegroundColor Yellow
    Write-Host "   - Database user doesn't exist" -ForegroundColor White
    Write-Host "   - Password is incorrect" -ForegroundColor White
    Write-Host "   - Database 'atlas' doesn't exist" -ForegroundColor White
    Write-Host "`n   Try creating the database:" -ForegroundColor Yellow
    Write-Host "   docker exec atlas_db psql -U $($envVars['POSTGRES_USER']) -c 'CREATE DATABASE atlas;'" -ForegroundColor White
}
