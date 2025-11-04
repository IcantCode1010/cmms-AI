# Agent Troubleshooting Utility

## Quick Start

### Option 1: Using Wrapper Scripts (Recommended)

The easiest way to run the troubleshooting script:

```bash
# Windows
cd C:\projects\cmms-AI
scripts\agent-logs\troubleshoot.bat

# Linux/Mac
cd /path/to/cmms-AI
chmod +x scripts/agent-logs/troubleshoot.sh
./scripts/agent-logs/troubleshoot.sh
```

This will automatically generate a timestamped report file.

### Option 2: Direct Python Execution

If you have Python and database access configured:

```bash
cd C:\projects\cmms-AI\scripts\agent-logs
source .env  # Load database credentials
python troubleshoot-agent.py --days 1
```

## What It Does

The troubleshooting utility generates a comprehensive report that includes:

✅ **Summary Statistics**
- Total tool invocations
- Success/failure rates
- Active users and sessions

✅ **Issue Detection**
- Automatically identifies common problems
- Highlights critical issues
- Provides troubleshooting recommendations

✅ **Tool Usage Analysis**
- Per-tool success rates
- Recent invocations with full details
- Error patterns

✅ **Draft Actions**
- Pending confirmations
- Applied drafts
- User activity

✅ **Docker Logs**
- Agents-proxy container logs
- API container logs (agent-related)
- Filtered for relevant entries

✅ **Recommendations**
- Specific troubleshooting steps
- Common issue solutions
- Best practices

## Report Example

```
================================================================================
AGENT TROUBLESHOOTING REPORT
================================================================================
Generated: 2025-10-21T12:00:00
Time Range: Last 1 days

================================================================================
SUMMARY
================================================================================
Total Tool Invocations: 93
  ✅ Successful: 93
  ❌ Failed: 0
  Success Rate: 100.00%

Draft Actions: 3
  Pending: 1
  Applied: 2

================================================================================
ISSUE ANALYSIS
================================================================================

⚠️  WARNINGS:
  ⚠️  CRITICAL: Agent receiving chat prompts but NOT calling any tools!

Troubleshooting Steps:
  1. Check agent system instructions (agents-proxy/src/index.js)
  2. Verify tools are registered in the agent's tools array
  3. Check OpenAI API key and model configuration
  ...
```

## Common Use Cases

### Daily Health Check
```bash
troubleshoot.bat
```

### Investigate User Report
```bash
python troubleshoot-agent.py --days 7 --output user-issue-report.txt
```

### Pre-Deployment Validation
```bash
# Before deployment
troubleshoot.bat > before.txt

# After deployment
troubleshoot.bat > after.txt

# Compare
diff before.txt after.txt
```

### Session-Specific Investigation
```bash
# Get session ID from UI or logs
python troubleshoot-agent.py --session fc132964-2ef4-49e0-b9ab-7260577cc040
```

## Requirements

### For Windows (.bat script)
- Docker Desktop running
- Python 3.x
- psycopg2-binary: `pip install psycopg2-binary`

### For Direct Execution
- Python 3.7+
- psycopg2-binary package
- Database credentials in `.env` file
- Access to Docker (for container logs)

## Output Location

Reports are saved to:
```
scripts/agent-logs/agent-troubleshoot-YYYYMMDD-HHMMSS.txt
```

Example: `agent-troubleshoot-20251021-120000.txt`

## Troubleshooting the Troubleshooter

### "psycopg2 not found"
```bash
pip install psycopg2-binary
```

### "Docker not running"
Start Docker Desktop and ensure containers are up:
```bash
docker-compose ps
```

### "Connection refused"
The .bat/.sh scripts handle this automatically by using Docker exec.
If running Python directly, ensure database is accessible.

## Documentation

For detailed troubleshooting guide, see:
[TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)

## Related Scripts

- `export-logs.js` - Export raw data to JSON/CSV
- `analyze-logs.py` - Statistical analysis
- `troubleshoot-agent.py` - Main troubleshooting script (this tool)

## Examples

### Check Last 24 Hours
```
troubleshoot.bat
```

### Check Last Week
```
troubleshoot.bat 7
```

### Custom Time Range
```bash
python troubleshoot-agent.py --days 3 --output last-3-days.txt
```

## Support

- Documentation: `docs/atlas-agents.md`
- Issues: GitHub Issues
- Discord: Community server
