#!/usr/bin/env python3
"""Test connection using different methods"""
import psycopg2
import sys

# Try connection string format
connstring = "postgresql://rootUser:mypassword@127.0.0.1:5432/atlas"

print("Testing with connection string...")
print(f"Connection: {connstring.replace('mypassword', '***')}")
print()

try:
    conn = psycopg2.connect(connstring)
    print("SUCCESS! Connection established")

    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM agent_tool_invocation_log")
    count = cursor.fetchone()[0]
    print(f"Found {count} agent tool log entries")

    cursor.close()
    conn.close()
    sys.exit(0)

except Exception as e:
    print(f"Failed: {e}")

    # Try with sslmode=disable
    print("\nTrying with SSL disabled...")
    connstring_nossl = f"{connstring}?sslmode=disable"
    try:
        conn = psycopg2.connect(connstring_nossl)
        print("SUCCESS with SSL disabled!")

        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM agent_tool_invocation_log")
        count = cursor.fetchone()[0]
        print(f"Found {count} agent tool log entries")

        cursor.close()
        conn.close()
        sys.exit(0)
    except Exception as e2:
        print(f"Also failed: {e2}")
        sys.exit(1)
