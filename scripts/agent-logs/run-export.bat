@echo off
REM Quick launcher for agent log export (Windows)

REM Load environment variables from .env file
for /f "delims=" %%x in (.env) do (set "%%x")

REM Run the Node.js export script
node export-logs.js %*
