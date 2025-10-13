#!/usr/bin/env python3
"""
Agent Tool Log Analysis Utility

Analyzes agent tool invocation logs and generates insights.

Usage:
    python analyze-logs.py [--days N] [--report-type TYPE]

Report Types:
    - summary: Overall usage summary
    - tools: Tool-specific analysis
    - users: User activity analysis
    - errors: Error analysis
    - sessions: Session analysis
    - all: Generate all reports (default)
"""

import psycopg2
import json
import sys
import os
import argparse
from datetime import datetime, timedelta
from collections import defaultdict
from typing import List, Dict, Any

# Database configuration from environment variables
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', '5432')),
    'database': os.getenv('DB_NAME', 'atlas'),
    'user': os.getenv('DB_USER', 'rootUser'),
    'password': os.getenv('DB_PASSWORD', 'mypassword'),
}

class LogAnalyzer:
    def __init__(self, connection):
        self.conn = connection
        self.cursor = connection.cursor()

    def fetch_logs(self, days: int) -> List[Dict[str, Any]]:
        """Fetch logs from the last N days"""
        query = """
            SELECT
                atil.id,
                atil.tool_name,
                atil.arguments_json,
                atil.result_count,
                atil.status,
                atil.correlation_id,
                atil.created_at,
                u.email as user_email,
                c.name as company_name
            FROM agent_tool_invocation_log atil
            LEFT JOIN own_user u ON atil.user_id = u.id
            LEFT JOIN company c ON atil.company_id = c.id
            WHERE atil.created_at > NOW() - INTERVAL '%s days'
            ORDER BY atil.created_at DESC
        """
        self.cursor.execute(query, (days,))

        columns = [desc[0] for desc in self.cursor.description]
        results = []
        for row in self.cursor.fetchall():
            record = dict(zip(columns, row))
            if record['arguments_json']:
                try:
                    record['arguments'] = json.loads(record['arguments_json'])
                except json.JSONDecodeError:
                    record['arguments'] = {}
            else:
                record['arguments'] = {}
            results.append(record)

        return results

    def generate_summary(self, logs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate overall summary statistics"""
        if not logs:
            return {'error': 'No logs found'}

        total = len(logs)
        successful = sum(1 for log in logs if log['status'] == 'success')
        failed = sum(1 for log in logs if log['status'] == 'error')

        unique_users = len(set(log['user_email'] for log in logs if log['user_email']))
        unique_sessions = len(set(log['correlation_id'] for log in logs if log['correlation_id']))
        unique_tools = len(set(log['tool_name'] for log in logs))

        first_log = min(log['created_at'] for log in logs)
        last_log = max(log['created_at'] for log in logs)
        time_span = (last_log - first_log).total_seconds() / 3600  # hours

        return {
            'total_invocations': total,
            'successful': successful,
            'failed': failed,
            'success_rate': f"{(successful/total*100):.2f}%" if total > 0 else "0%",
            'unique_users': unique_users,
            'unique_sessions': unique_sessions,
            'unique_tools': unique_tools,
            'time_span_hours': round(time_span, 2),
            'avg_calls_per_hour': round(total / time_span, 2) if time_span > 0 else 0,
            'date_range': {
                'start': first_log.isoformat(),
                'end': last_log.isoformat(),
            }
        }

    def analyze_tools(self, logs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Analyze tool usage patterns"""
        tool_stats = defaultdict(lambda: {
            'total': 0,
            'successful': 0,
            'failed': 0,
            'total_results': 0,
            'last_used': None,
        })

        for log in logs:
            tool = log['tool_name']
            tool_stats[tool]['total'] += 1

            if log['status'] == 'success':
                tool_stats[tool]['successful'] += 1
            elif log['status'] == 'error':
                tool_stats[tool]['failed'] += 1

            if log['result_count']:
                tool_stats[tool]['total_results'] += log['result_count']

            last_used = tool_stats[tool]['last_used']
            if not last_used or log['created_at'] > last_used:
                tool_stats[tool]['last_used'] = log['created_at']

        results = []
        for tool, stats in tool_stats.items():
            results.append({
                'tool_name': tool,
                'total_calls': stats['total'],
                'successful': stats['successful'],
                'failed': stats['failed'],
                'success_rate': f"{(stats['successful']/stats['total']*100):.2f}%",
                'avg_results': round(stats['total_results'] / stats['total'], 2) if stats['total'] > 0 else 0,
                'last_used': stats['last_used'].isoformat() if stats['last_used'] else None,
            })

        return sorted(results, key=lambda x: x['total_calls'], reverse=True)

    def analyze_users(self, logs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Analyze user activity"""
        user_stats = defaultdict(lambda: {
            'total_calls': 0,
            'unique_sessions': set(),
            'tools_used': set(),
            'company': None,
            'last_activity': None,
        })

        for log in logs:
            email = log['user_email']
            if not email:
                continue

            user_stats[email]['total_calls'] += 1

            if log['correlation_id']:
                user_stats[email]['unique_sessions'].add(log['correlation_id'])

            user_stats[email]['tools_used'].add(log['tool_name'])
            user_stats[email]['company'] = log['company_name']

            last = user_stats[email]['last_activity']
            if not last or log['created_at'] > last:
                user_stats[email]['last_activity'] = log['created_at']

        results = []
        for email, stats in user_stats.items():
            results.append({
                'user_email': email,
                'company': stats['company'],
                'total_calls': stats['total_calls'],
                'unique_sessions': len(stats['unique_sessions']),
                'tools_used': len(stats['tools_used']),
                'last_activity': stats['last_activity'].isoformat() if stats['last_activity'] else None,
            })

        return sorted(results, key=lambda x: x['total_calls'], reverse=True)

    def analyze_errors(self, logs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze error patterns"""
        errors = [log for log in logs if log['status'] == 'error']

        if not errors:
            return {'message': 'No errors found', 'error_count': 0}

        error_by_tool = defaultdict(int)
        error_by_user = defaultdict(int)

        for error in errors:
            error_by_tool[error['tool_name']] += 1
            if error['user_email']:
                error_by_user[error['user_email']] += 1

        return {
            'total_errors': len(errors),
            'error_rate': f"{(len(errors)/len(logs)*100):.2f}%",
            'errors_by_tool': dict(sorted(error_by_tool.items(), key=lambda x: x[1], reverse=True)),
            'errors_by_user': dict(sorted(error_by_user.items(), key=lambda x: x[1], reverse=True)),
            'recent_errors': [
                {
                    'tool': e['tool_name'],
                    'user': e['user_email'],
                    'time': e['created_at'].isoformat(),
                    'arguments': e['arguments'],
                }
                for e in errors[:10]
            ]
        }

    def analyze_sessions(self, logs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Analyze conversation sessions"""
        sessions = defaultdict(lambda: {
            'tools': [],
            'tool_count': 0,
            'user': None,
            'company': None,
            'start_time': None,
            'end_time': None,
            'duration_seconds': 0,
        })

        for log in logs:
            sid = log['correlation_id']
            if not sid:
                continue

            sessions[sid]['tools'].append({
                'tool': log['tool_name'],
                'time': log['created_at'],
                'status': log['status'],
            })
            sessions[sid]['tool_count'] += 1
            sessions[sid]['user'] = log['user_email']
            sessions[sid]['company'] = log['company_name']

            start = sessions[sid]['start_time']
            end = sessions[sid]['end_time']

            if not start or log['created_at'] < start:
                sessions[sid]['start_time'] = log['created_at']
            if not end or log['created_at'] > end:
                sessions[sid]['end_time'] = log['created_at']

        # Calculate durations
        for sid, data in sessions.items():
            if data['start_time'] and data['end_time']:
                data['duration_seconds'] = (data['end_time'] - data['start_time']).total_seconds()

        results = []
        for sid, data in sessions.items():
            results.append({
                'session_id': sid,
                'user': data['user'],
                'company': data['company'],
                'tool_count': data['tool_count'],
                'duration_seconds': round(data['duration_seconds'], 2),
                'start_time': data['start_time'].isoformat() if data['start_time'] else None,
                'tool_sequence': [t['tool'] for t in sorted(data['tools'], key=lambda x: x['time'])],
            })

        return sorted(results, key=lambda x: x['tool_count'], reverse=True)


def main():
    parser = argparse.ArgumentParser(description='Analyze agent tool invocation logs')
    parser.add_argument('--days', type=int, default=7, help='Number of days to analyze (default: 7)')
    parser.add_argument('--report-type', choices=['summary', 'tools', 'users', 'errors', 'sessions', 'all'],
                        default='all', help='Type of report to generate (default: all)')
    parser.add_argument('--output', help='Output file path (default: stdout)')

    args = parser.parse_args()

    try:
        # Connect to database
        conn = psycopg2.connect(**DB_CONFIG)
        analyzer = LogAnalyzer(conn)

        print(f"Fetching logs from last {args.days} days...", file=sys.stderr)
        logs = analyzer.fetch_logs(args.days)
        print(f"Found {len(logs)} log entries", file=sys.stderr)

        # Generate reports
        report = {}

        if args.report_type in ['summary', 'all']:
            print("Generating summary...", file=sys.stderr)
            report['summary'] = analyzer.generate_summary(logs)

        if args.report_type in ['tools', 'all']:
            print("Analyzing tools...", file=sys.stderr)
            report['tools'] = analyzer.analyze_tools(logs)

        if args.report_type in ['users', 'all']:
            print("Analyzing users...", file=sys.stderr)
            report['users'] = analyzer.analyze_users(logs)

        if args.report_type in ['errors', 'all']:
            print("Analyzing errors...", file=sys.stderr)
            report['errors'] = analyzer.analyze_errors(logs)

        if args.report_type in ['sessions', 'all']:
            print("Analyzing sessions...", file=sys.stderr)
            report['sessions'] = analyzer.analyze_sessions(logs)

        # Output results
        output_json = json.dumps(report, indent=2, default=str)

        if args.output:
            with open(args.output, 'w') as f:
                f.write(output_json)
            print(f"✓ Report saved to {args.output}", file=sys.stderr)
        else:
            print(output_json)

        conn.close()

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
