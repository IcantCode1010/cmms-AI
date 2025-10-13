#!/usr/bin/env python3
"""Test direct connection with detailed error info"""
import psycopg2
import sys

DB_CONFIG = {
    'host': '127.0.0.1',  # Use IPv4 explicitly instead of localhost
    'port': 5432,
    'database': 'atlas',
    'user': 'rootUser',
    'password': 'mypassword',
}

print("Testing connection with:")
print(f"  Host: {DB_CONFIG['host']}")
print(f"  Port: {DB_CONFIG['port']}")
print(f"  Database: {DB_CONFIG['database']}")
print(f"  User: {DB_CONFIG['user']}")
print()

try:
    conn = psycopg2.connect(**DB_CONFIG)
    print("✓ SUCCESS! Connection established")

    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM agent_tool_invocation_log")
    count = cursor.fetchone()[0]
    print(f"✓ Found {count} agent tool log entries")

    cursor.close()
    conn.close()
    sys.exit(0)

except psycopg2.OperationalError as e:
    print(f"✗ Connection failed: {e}")
    print()
    print("Diagnosis:")
    if "scram" in str(e).lower():
        print("  Issue: SCRAM authentication problem")
        print("  Solution: Upgrade psycopg2-binary")
        print("  Run: pip install --upgrade psycopg2-binary")
    elif "password authentication failed" in str(e):
        print("  Issue: Password authentication failed")
        print("  The password might be incorrect or not properly hashed")
    else:
        print(f"  Unknown issue: {e}")
    sys.exit(1)
