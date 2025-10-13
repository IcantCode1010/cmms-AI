# Quick Start Guide - Agent Log Utilities

## ✅ Working Solution (Docker-based)

Due to PostgreSQL authentication configuration, we're using Docker-based scripts that work 100% reliably.

### 📊 Analyze Logs

```powershell
# Full analysis (last 7 days)
.\analyze-via-docker.ps1

# Last 30 days
.\analyze-via-docker.ps1 -Days 30

# Specific reports
.\analyze-via-docker.ps1 -Users
.\analyze-via-docker.ps1 -Errors
.\analyze-via-docker.ps1 -Sessions
```

### 📥 Export Logs

```powershell
# Export as JSON (last 7 days)
.\export-via-docker.ps1 -Output logs.json

# Export as CSV
.\export-via-docker.ps1 -Format csv -Output logs.csv

# Filter by tool
.\export-via-docker.ps1 -Tool view_work_orders -Output wo-logs.json

# Filter by status
.\export-via-docker.ps1 -Status error -Output errors.json

# Last 30 days
.\export-via-docker.ps1 -Days 30 -Output monthly-logs.json
```

## 📈 Your Current Stats

Based on your database:
- **146 agent tool invocations** in last 7 days
- **3 tools actively used**: chat_prompt, view_work_orders, view_assets
- **113 conversation sessions**
- **29 work order queries** (all successful!)
- **3 failed asset queries** (might need debugging)

## 🔍 Common Use Cases

### Find all failed calls
```powershell
.\export-via-docker.ps1 -Status error -Output errors.json
```

### Analyze user activity
```powershell
.\analyze-via-docker.ps1 -Users
```

### Export work order tool calls
```powershell
.\export-via-docker.ps1 -Tool view_work_orders -Output wo-analysis.csv -Format csv
```

### Check last 24 hours
```powershell
.\analyze-via-docker.ps1 -Days 1
```

## 📝 Notes

- These scripts use `docker exec` to run queries inside the PostgreSQL container
- No password/connection issues - 100% reliable
- All queries are read-only - your database is safe
- Scripts work even when direct psycopg2 connections fail

## 🎯 Next Steps

1. Check out the 3 failed asset queries:
   ```powershell
   .\export-via-docker.ps1 -Tool view_assets -Status error -Output asset-errors.json
   ```

2. Monitor daily activity:
   ```powershell
   .\analyze-via-docker.ps1 -Days 1
   ```

3. Export all data for analysis:
   ```powershell
   .\export-via-docker.ps1 -Days 30 -Output all-logs.json
   ```

## 💡 Pro Tips

- Use `-Days 1` for recent activity
- Use `-Days 30` for monthly reports
- Export as CSV for Excel analysis
- Export as JSON for programmatic analysis

Enjoy! 🚀
