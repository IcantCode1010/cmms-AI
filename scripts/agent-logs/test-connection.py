#!/usr/bin/env python3
"""
Test database connection for agent log utilities
"""

import psycopg2
import os
import sys

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', '127.0.0.1'),  # Use 127.0.0.1 instead of localhost to force IPv4
    'port': int(os.getenv('DB_PORT', '5432')),
    'database': os.getenv('DB_NAME', 'atlas'),
    'user': os.getenv('DB_USER', 'rootUser'),
    'password': os.getenv('DB_PASSWORD', 'mypassword'),
}

def test_connection():
    print("Testing database connection...")
    print(f"Host: {DB_CONFIG['host']}")
    print(f"Port: {DB_CONFIG['port']}")
    print(f"Database: {DB_CONFIG['database']}")
    print(f"User: {DB_CONFIG['user']}")
    print()

    try:
        # Try to connect
        conn = psycopg2.connect(**DB_CONFIG)
        print("✓ Connection successful!")

        # Test query
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM agent_tool_invocation_log")
        count = cursor.fetchone()[0]
        print(f"✓ Found {count} agent tool log entries")

        # Get date range
        cursor.execute("""
            SELECT
                MIN(created_at) as first_log,
                MAX(created_at) as last_log
            FROM agent_tool_invocation_log
        """)
        result = cursor.fetchone()
        if result and result[0]:
            print(f"✓ Date range: {result[0]} to {result[1]}")

        cursor.close()
        conn.close()
        print("\nDatabase connection is working correctly!")
        return True

    except psycopg2.OperationalError as e:
        print(f"✗ Connection failed: {e}")
        print("\nTroubleshooting tips:")
        print("1. Make sure PostgreSQL is running")
        print("2. Check your .env file has correct credentials")
        print("3. Verify database exists: psql -U rootUser -d atlas")
        print("4. If using Docker: docker-compose up -d postgres")
        return False
    except psycopg2.ProgrammingError as e:
        print(f"✗ Table not found: {e}")
        print("\nThe agent_tool_invocation_log table doesn't exist.")
        print("Make sure the database schema is up to date.")
        return False
    except Exception as e:
        print(f"✗ Unexpected error: {e}")
        return False

if __name__ == '__main__':
    success = test_connection()
    sys.exit(0 if success else 1)
