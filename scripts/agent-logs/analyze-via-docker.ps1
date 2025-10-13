# Analyze agent logs using docker exec (bypasses connection issues)
param(
    [int]$Days = 7,
    [switch]$Summary,
    [switch]$Tools,
    [switch]$Users,
    [switch]$Errors,
    [switch]$Sessions
)

Write-Host "`n=== Agent Log Analysis (via Docker) ===`n" -ForegroundColor Cyan

$baseWhere = "created_at > NOW() - INTERVAL '$Days days'"

# Summary Report
if ($Summary -or (-not $Tools -and -not $Users -and -not $Errors -and -not $Sessions)) {
    Write-Host "[Summary] Last $Days days" -ForegroundColor Yellow
    Write-Host ("=" * 50) -ForegroundColor Gray

    $summaryQuery = "SELECT COUNT(*) as total_invocations, COUNT(CASE WHEN status = 'success' THEN 1 END) as successful, COUNT(CASE WHEN status = 'error' THEN 1 END) as failed, COUNT(DISTINCT user_id) as unique_users, COUNT(DISTINCT correlation_id) as unique_sessions, COUNT(DISTINCT tool_name) as unique_tools FROM agent_tool_invocation_log WHERE $baseWhere;"

    $result = docker exec atlas_db psql -U rootUser -d atlas -t -c $summaryQuery
    Write-Host $result -ForegroundColor White
    Write-Host ""
}

# Tools Analysis
if ($Tools -or (-not $Summary -and -not $Users -and -not $Errors -and -not $Sessions)) {
    Write-Host "[Tool Usage]" -ForegroundColor Yellow
    Write-Host ("=" * 50) -ForegroundColor Gray

    $toolsQuery = "SELECT tool_name, COUNT(*) as calls, COUNT(CASE WHEN status = 'success' THEN 1 END) as successful, COUNT(CASE WHEN status = 'error' THEN 1 END) as failed, ROUND(AVG(result_count), 1) as avg_results FROM agent_tool_invocation_log WHERE $baseWhere GROUP BY tool_name ORDER BY calls DESC;"

    docker exec atlas_db psql -U rootUser -d atlas -c $toolsQuery
    Write-Host ""
}

# User Activity
if ($Users) {
    Write-Host "[User Activity]" -ForegroundColor Yellow
    Write-Host ("=" * 50) -ForegroundColor Gray

    $usersQuery = "SELECT u.email, COUNT(*) as total_calls, COUNT(DISTINCT atil.correlation_id) as sessions, MAX(atil.created_at) as last_activity FROM agent_tool_invocation_log atil JOIN own_user u ON atil.user_id = u.id WHERE $baseWhere GROUP BY u.email ORDER BY total_calls DESC LIMIT 20;"

    docker exec atlas_db psql -U rootUser -d atlas -c $usersQuery
    Write-Host ""
}

# Error Analysis
if ($Errors) {
    Write-Host "[Error Analysis]" -ForegroundColor Yellow
    Write-Host ("=" * 50) -ForegroundColor Gray

    $errorsQuery = "SELECT tool_name, COUNT(*) as error_count, MAX(created_at) as last_error FROM agent_tool_invocation_log WHERE $baseWhere AND status = 'error' GROUP BY tool_name ORDER BY error_count DESC;"

    docker exec atlas_db psql -U rootUser -d atlas -c $errorsQuery
    Write-Host ""
}

# Session Analysis
if ($Sessions) {
    Write-Host "[Session Analysis]" -ForegroundColor Yellow
    Write-Host ("=" * 50) -ForegroundColor Gray

    $sessionsQuery = "SELECT correlation_id, COUNT(*) as tool_calls, STRING_AGG(DISTINCT tool_name, ', ') as tools_used, MIN(created_at) as start_time, MAX(created_at) as end_time FROM agent_tool_invocation_log WHERE $baseWhere AND correlation_id IS NOT NULL GROUP BY correlation_id ORDER BY tool_calls DESC LIMIT 20;"

    docker exec atlas_db psql -U rootUser -d atlas -c $sessionsQuery
    Write-Host ""
}

Write-Host "=== Analysis Complete ===" -ForegroundColor Green
