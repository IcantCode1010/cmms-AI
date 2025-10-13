# Agent Tool Log Utilities

Utilities for capturing, exporting, and analyzing agent tool invocation logs from the Atlas CMMS system.

## Overview

This toolkit provides three complementary approaches to working with agent tool logs:

1. **SQL Queries** - Direct database queries for quick analysis
2. **Node.js Export Script** - Flexible log export to JSON/CSV formats
3. **Python Analysis Script** - Comprehensive log analysis and reporting

## Prerequisites

### Database Access
All utilities require access to the PostgreSQL database with the `agent_tool_invocation_log` table.

**Database Credentials** (configured in `.env`):
- Host: localhost
- Port: 5432
- Database: atlas
- User: rootUser
- Password: mypassword

### Installation

**Node.js Script:**
```bash
cd scripts/agent-logs
npm install
```

**Python Script:**
```bash
pip install psycopg2-binary
```

### Quick Start

**Test your database connection first:**
```bash
python test-connection.py
```

If you see "✓ Connection successful!" you're ready to go!

## Usage

### 1. SQL Queries (query-tool-logs.sql)

Run these queries directly against your PostgreSQL database using `psql`, pgAdmin, or any SQL client.

**Examples:**

```bash
# Using psql
psql -U postgres -d atlas -f query-tool-logs.sql

# Run specific query
psql -U postgres -d atlas -c "SELECT tool_name, COUNT(*) FROM agent_tool_invocation_log GROUP BY tool_name;"

# Export to CSV
psql -U postgres -d atlas -c "\copy (SELECT * FROM agent_tool_invocation_log WHERE created_at > NOW() - INTERVAL '7 days') TO 'logs.csv' CSV HEADER"
```

**Available Queries:**
- Recent tool invocations (last 24 hours)
- Tool usage summary
- User activity analysis
- Conversation session details
- Error rate analysis
- Hourly usage patterns
- Company usage breakdown
- Tool combination patterns
- Failed tool calls for debugging

### 2. Node.js Export Script (export-logs.js)

Export logs to JSON or CSV format with flexible filtering.

**Basic Usage:**

```bash
# Export last 7 days as JSON
node export-logs.js --output logs.json

# Export as CSV
node export-logs.js --format csv --output logs.csv

# Export last 24 hours
node export-logs.js --days 1 --output recent-logs.json
```

**Advanced Filtering:**

```bash
# Filter by tool name
node export-logs.js --tool view_work_orders --output wo-logs.json

# Filter by status
node export-logs.js --status error --output errors.json

# Filter by user ID
node export-logs.js --user 42 --output user-42-logs.json

# Combine filters
node export-logs.js --tool view_work_orders --status success --days 1 --output success-logs.csv
```

**Pipe to Other Tools:**

```bash
# Use jq for JSON processing
node export-logs.js --days 1 | jq '.[] | select(.tool_name == "view_work_orders")'

# Count tools by type
node export-logs.js --days 7 | jq -r '.[].tool_name' | sort | uniq -c
```

**Environment Variables:**

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=atlas
export DB_USER=postgres
export DB_PASSWORD=your_password

node export-logs.js --output logs.json
```

### 3. Python Analysis Script (analyze-logs.py)

Generate comprehensive analysis reports with insights and statistics.

**Basic Usage:**

```bash
# Generate full report (all analysis types)
python analyze-logs.py --days 7 --output report.json

# Generate specific report type
python analyze-logs.py --report-type summary
python analyze-logs.py --report-type tools
python analyze-logs.py --report-type users
python analyze-logs.py --report-type errors
python analyze-logs.py --report-type sessions
```

**Report Types:**

1. **Summary** - Overall usage statistics
   - Total invocations, success rate
   - Unique users, sessions, tools
   - Time span and calls per hour

2. **Tools** - Tool-specific analysis
   - Calls per tool
   - Success/failure rates
   - Average results per call
   - Last usage timestamp

3. **Users** - User activity analysis
   - Calls per user
   - Unique sessions per user
   - Tools used by each user
   - Last activity timestamp

4. **Errors** - Error pattern analysis
   - Total errors and error rate
   - Errors by tool
   - Errors by user
   - Recent error details

5. **Sessions** - Conversation session analysis
   - Tool sequences in sessions
   - Session duration
   - Tools per session
   - User and company per session

**Example Output:**

```json
{
  "summary": {
    "total_invocations": 1523,
    "successful": 1445,
    "failed": 78,
    "success_rate": "94.88%",
    "unique_users": 23,
    "unique_sessions": 187,
    "unique_tools": 4,
    "avg_calls_per_hour": 8.96
  },
  "tools": [
    {
      "tool_name": "view_work_orders",
      "total_calls": 876,
      "successful": 850,
      "failed": 26,
      "success_rate": "97.03%",
      "avg_results": 3.4
    }
  ]
}
```

## Common Use Cases

### Monitor Tool Usage
```bash
# Quick summary of recent activity
psql -U postgres -d atlas -f query-tool-logs.sql | head -n 50

# Export for analysis
node export-logs.js --days 30 --output monthly-logs.json
python analyze-logs.py --days 30 --output monthly-report.json
```

### Debug Errors
```bash
# Export failed calls
node export-logs.js --status error --days 7 --output errors.json

# Analyze error patterns
python analyze-logs.py --report-type errors --days 7
```

### User Activity Tracking
```bash
# Export specific user's activity
node export-logs.js --user 42 --days 30 --output user-42-activity.csv

# Analyze all users
python analyze-logs.py --report-type users --days 30
```

### Session Analysis
```bash
# Analyze conversation patterns
python analyze-logs.py --report-type sessions --days 7 --output sessions.json

# Find most common tool sequences
psql -U postgres -d atlas -c "SELECT tool_sequence, COUNT(*) FROM (SELECT correlation_id, STRING_AGG(tool_name, ' → ' ORDER BY created_at) as tool_sequence FROM agent_tool_invocation_log GROUP BY correlation_id) sub GROUP BY tool_sequence ORDER BY count DESC LIMIT 10;"
```

## Database Schema

The utilities work with the `agent_tool_invocation_log` table:

```sql
CREATE TABLE agent_tool_invocation_log (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    company_id BIGINT,
    tool_name VARCHAR(255) NOT NULL,
    arguments_json TEXT,
    result_count INTEGER,
    status VARCHAR(50),
    correlation_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES own_user(id),
    FOREIGN KEY (company_id) REFERENCES company(id)
);
```

## Troubleshooting

### Connection Issues

**Node.js:**
```bash
# Test connection
node -e "const {Client}=require('pg');const c=new Client({host:'localhost',database:'atlas',user:'postgres',password:'postgres'});c.connect().then(()=>console.log('OK')).catch(e=>console.error(e));"
```

**Python:**
```bash
# Test connection
python -c "import psycopg2; conn=psycopg2.connect(host='localhost',database='atlas',user='postgres',password='postgres'); print('OK')"
```

### No Data Found

Check if logs exist:
```sql
SELECT COUNT(*) FROM agent_tool_invocation_log;
SELECT MAX(created_at) FROM agent_tool_invocation_log;
```

### Permission Denied

Ensure database user has SELECT permissions:
```sql
GRANT SELECT ON agent_tool_invocation_log TO your_user;
GRANT SELECT ON own_user TO your_user;
GRANT SELECT ON company TO your_user;
```

## Integration with Monitoring

### Scheduled Reports

Add to crontab for daily reports:
```bash
# Daily summary at 9 AM
0 9 * * * cd /path/to/scripts/agent-logs && python analyze-logs.py --days 1 --output /path/to/reports/daily-$(date +\%Y\%m\%d).json
```

### Alerting on Errors

Monitor error rates:
```bash
#!/bin/bash
ERROR_COUNT=$(node export-logs.js --status error --days 1 | jq length)
if [ "$ERROR_COUNT" -gt 10 ]; then
  echo "High error rate: $ERROR_COUNT errors in last 24h" | mail -s "Agent Alert" admin@example.com
fi
```

## Contributing

When adding new analysis features:
1. Update SQL queries in `query-tool-logs.sql`
2. Add export options to `export-logs.js`
3. Add analysis methods to `analyze-logs.py`
4. Update this README with examples

## License

Internal use only - Atlas CMMS project
