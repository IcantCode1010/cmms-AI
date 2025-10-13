@echo off
REM Quick launcher for agent log analysis (Windows)

REM Load environment variables from .env file
for /f "delims=" %%x in (.env) do (set "%%x")

REM Run the Python analysis script
python analyze-logs.py %*
