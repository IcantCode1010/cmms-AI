# PowerShell launcher for agent log analysis
# Loads .env file and runs Python script

# Load .env file
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, 'Process')
        }
    }
    Write-Host "✓ Loaded configuration from .env" -ForegroundColor Green
} else {
    Write-Host "⚠ Warning: .env file not found, using defaults" -ForegroundColor Yellow
}

# Run the Python analysis script
python analyze-logs.py $args
