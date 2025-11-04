#!/usr/bin/env node

/**
 * Agent Tool Log Export Utility
 *
 * Exports agent tool invocation logs from the database to JSON/CSV formats
 *
 * Usage:
 *   node export-logs.js [options]
 *
 * Options:
 *   --format json|csv       Output format (default: json)
 *   --days N                Days to look back (default: 7)
 *   --tool TOOL_NAME        Filter by tool name
 *   --user USER_ID          Filter by user ID
 *   --status success|error  Filter by status
 *   --output FILE           Output file path (default: stdout)
 *   --limit N               Limit results (default: 1000)
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration from environment variables
const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',  // Use 127.0.0.1 instead of localhost to force IPv4
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'atlas',
  user: process.env.DB_USER || 'rootUser',
  password: process.env.DB_PASSWORD || 'mypassword',
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    format: 'json',
    days: 7,
    limit: 1000,
    tool: null,
    user: null,
    status: null,
    output: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--format':
        options.format = next;
        i++;
        break;
      case '--days':
        options.days = parseInt(next, 10);
        i++;
        break;
      case '--tool':
        options.tool = next;
        i++;
        break;
      case '--user':
        options.user = parseInt(next, 10);
        i++;
        break;
      case '--status':
        options.status = next;
        i++;
        break;
      case '--output':
        options.output = next;
        i++;
        break;
      case '--limit':
        options.limit = parseInt(next, 10);
        i++;
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Agent Tool Log Export Utility

Usage:
  node export-logs.js [options]

Options:
  --format json|csv       Output format (default: json)
  --days N                Days to look back (default: 7)
  --tool TOOL_NAME        Filter by tool name
  --user USER_ID          Filter by user ID
  --status success|error  Filter by status
  --output FILE           Output file path (default: stdout)
  --limit N               Limit results (default: 1000)
  --help                  Show this help message

Environment Variables:
  DB_HOST                 Database host (default: localhost)
  DB_PORT                 Database port (default: 5432)
  DB_NAME                 Database name (default: atlas)
  DB_USER                 Database user (default: postgres)
  DB_PASSWORD             Database password (default: postgres)

Examples:
  # Export last 24 hours as JSON
  node export-logs.js --days 1 --output logs.json

  # Export work order tool calls as CSV
  node export-logs.js --format csv --tool view_work_orders --output wo-logs.csv

  # Export failed calls only
  node export-logs.js --status error --days 7 --output errors.json

  # Export to stdout (pipe to other commands)
  node export-logs.js --days 1 | jq '.[] | select(.tool_name == "view_work_orders")'
  `);
}

// Build SQL query based on options
function buildQuery(options) {
  let query = `
    SELECT
      atil.id,
      atil.tool_name,
      atil.arguments_json,
      atil.result_count,
      atil.status,
      atil.correlation_id,
      atil.created_at,
      u.id as user_id,
      u.email as user_email,
      u.first_name || ' ' || u.last_name as user_name,
      c.id as company_id,
      c.name as company_name
    FROM agent_tool_invocation_log atil
    LEFT JOIN own_user u ON atil.user_id = u.id
    LEFT JOIN company c ON atil.company_id = c.id
    WHERE atil.created_at > NOW() - INTERVAL '${options.days} days'
  `;

  const params = [];
  let paramIndex = 1;

  if (options.tool) {
    query += ` AND atil.tool_name = $${paramIndex}`;
    params.push(options.tool);
    paramIndex++;
  }

  if (options.user) {
    query += ` AND atil.user_id = $${paramIndex}`;
    params.push(options.user);
    paramIndex++;
  }

  if (options.status) {
    query += ` AND atil.status = $${paramIndex}`;
    params.push(options.status);
    paramIndex++;
  }

  query += ` ORDER BY atil.created_at DESC LIMIT ${options.limit}`;

  return { query, params };
}

// Convert results to CSV format
function toCSV(rows) {
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const csvRows = [headers.join(',')];

  for (const row of rows) {
    const values = headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';

      // Escape quotes and wrap in quotes if contains comma or newline
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

// Main execution
async function main() {
  const options = parseArgs();

  const client = new Client(DB_CONFIG);

  try {
    await client.connect();
    console.error(`Connected to database: ${DB_CONFIG.database}@${DB_CONFIG.host}`);
    console.error(`Fetching logs (last ${options.days} days)...`);

    const { query, params } = buildQuery(options);
    const result = await client.query(query, params);

    console.error(`Found ${result.rows.length} records`);

    // Parse JSON arguments if present
    const rows = result.rows.map(row => ({
      ...row,
      arguments: row.arguments_json ? JSON.parse(row.arguments_json) : null,
      arguments_json: undefined, // Remove raw JSON field
    }));

    // Format output
    let output;
    if (options.format === 'csv') {
      output = toCSV(rows);
    } else {
      output = JSON.stringify(rows, null, 2);
    }

    // Write to file or stdout
    if (options.output) {
      fs.writeFileSync(options.output, output, 'utf8');
      console.error(`✓ Exported to ${options.output}`);
    } else {
      console.log(output);
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { parseArgs, buildQuery, toCSV };
