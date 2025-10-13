# Export agent logs using docker exec (bypasses connection issues)
param(
    [int]$Days = 7,
    [string]$Format = "json",
    [string]$Output = "logs.json",
    [string]$Tool = "",
    [string]$Status = ""
)

Write-Host "Exporting agent logs via Docker..." -ForegroundColor Cyan

# Build SQL query
$whereClause = "atil.created_at > NOW() - INTERVAL '$Days days'"

if ($Tool) {
    $whereClause += " AND atil.tool_name = '$Tool'"
}

if ($Status) {
    $whereClause += " AND atil.status = '$Status'"
}

$query = @"
SELECT
    atil.id,
    atil.tool_name,
    atil.arguments_json as arguments,
    atil.result_count,
    atil.status,
    atil.correlation_id,
    atil.created_at,
    u.email as user_email,
    c.name as company_name
FROM agent_tool_invocation_log atil
LEFT JOIN own_user u ON atil.user_id = u.id
LEFT JOIN company c ON atil.company_id = c.id
WHERE $whereClause
ORDER BY atil.created_at DESC
LIMIT 1000;
"@

Write-Host "Querying database..." -ForegroundColor Yellow

if ($Format -eq "csv") {
    # Export as CSV
    $csvCmd = "COPY (SELECT atil.id, atil.tool_name, atil.arguments_json as arguments, atil.result_count, atil.status, atil.correlation_id, atil.created_at, u.email as user_email, c.name as company_name FROM agent_tool_invocation_log atil LEFT JOIN own_user u ON atil.user_id = u.id LEFT JOIN company c ON atil.company_id = c.id WHERE $whereClause ORDER BY atil.created_at DESC LIMIT 1000) TO STDOUT WITH CSV HEADER"
    docker exec atlas_db psql -U rootUser -d atlas -c $csvCmd | Out-File -FilePath $Output -Encoding utf8
} else {
    # Export as JSON
    $jsonCmd = "SELECT json_agg(t) FROM (SELECT atil.id, atil.tool_name, atil.arguments_json as arguments, atil.result_count, atil.status, atil.correlation_id, atil.created_at, u.email as user_email, c.name as company_name FROM agent_tool_invocation_log atil LEFT JOIN own_user u ON atil.user_id = u.id LEFT JOIN company c ON atil.company_id = c.id WHERE $whereClause ORDER BY atil.created_at DESC LIMIT 1000) t"
    $result = docker exec atlas_db psql -U rootUser -d atlas -t -c $jsonCmd
    $result | Out-File -FilePath $Output -Encoding utf8
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "[SUCCESS] Exported to $Output" -ForegroundColor Green
    $size = (Get-Item $Output).Length
    Write-Host "File size: $([math]::Round($size/1KB, 2)) KB" -ForegroundColor White
} else {
    Write-Host "[ERROR] Export failed" -ForegroundColor Red
}
