-- Agent Tool Invocation Log Query Utility
-- Usage: Run these queries against your PostgreSQL database

-- =============================================================================
-- 1. Recent Tool Invocations (Last 24 hours)
-- =============================================================================
SELECT
    atil.id,
    atil.tool_name,
    atil.status,
    atil.result_count,
    atil.created_at,
    u.email as user_email,
    u.first_name || ' ' || u.last_name as user_name,
    c.name as company_name,
    atil.correlation_id
FROM agent_tool_invocation_log atil
LEFT JOIN own_user u ON atil.user_id = u.id
LEFT JOIN company c ON atil.company_id = c.id
WHERE atil.created_at > NOW() - INTERVAL '24 hours'
ORDER BY atil.created_at DESC
LIMIT 100;

-- =============================================================================
-- 2. Tool Usage Summary (By Tool Name)
-- =============================================================================
SELECT
    tool_name,
    COUNT(*) as total_invocations,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
    COUNT(CASE WHEN status = 'error' THEN 1 END) as failed,
    ROUND(AVG(result_count), 2) as avg_results,
    MAX(created_at) as last_used
FROM agent_tool_invocation_log
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY tool_name
ORDER BY total_invocations DESC;

-- =============================================================================
-- 3. User Activity (Most Active Users)
-- =============================================================================
SELECT
    u.email,
    u.first_name || ' ' || u.last_name as full_name,
    c.name as company,
    COUNT(*) as tool_calls,
    COUNT(DISTINCT atil.correlation_id) as unique_sessions,
    MAX(atil.created_at) as last_activity
FROM agent_tool_invocation_log atil
JOIN own_user u ON atil.user_id = u.id
JOIN company c ON atil.company_id = c.id
WHERE atil.created_at > NOW() - INTERVAL '7 days'
GROUP BY u.id, u.email, u.first_name, u.last_name, c.name
ORDER BY tool_calls DESC
LIMIT 20;

-- =============================================================================
-- 4. Conversation Session Details (By Correlation ID)
-- =============================================================================
-- Replace 'YOUR_CORRELATION_ID' with actual correlation ID
SELECT
    atil.id,
    atil.tool_name,
    atil.arguments_json,
    atil.result_count,
    atil.status,
    atil.created_at
FROM agent_tool_invocation_log atil
WHERE atil.correlation_id = 'YOUR_CORRELATION_ID'
ORDER BY atil.created_at ASC;

-- =============================================================================
-- 5. Error Rate Analysis
-- =============================================================================
SELECT
    DATE(created_at) as date,
    tool_name,
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'error' THEN 1 END) as errors,
    ROUND(100.0 * COUNT(CASE WHEN status = 'error' THEN 1 END) / COUNT(*), 2) as error_rate_pct
FROM agent_tool_invocation_log
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), tool_name
HAVING COUNT(*) >= 5
ORDER BY error_rate_pct DESC, date DESC;

-- =============================================================================
-- 6. Hourly Usage Pattern (Peak Times)
-- =============================================================================
SELECT
    EXTRACT(HOUR FROM created_at) as hour_of_day,
    COUNT(*) as invocations,
    COUNT(DISTINCT user_id) as unique_users
FROM agent_tool_invocation_log
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY EXTRACT(HOUR FROM created_at)
ORDER BY hour_of_day;

-- =============================================================================
-- 7. Company Usage Breakdown
-- =============================================================================
SELECT
    c.name as company_name,
    COUNT(*) as total_tool_calls,
    COUNT(DISTINCT atil.user_id) as unique_users,
    COUNT(DISTINCT DATE(atil.created_at)) as days_active,
    MAX(atil.created_at) as last_activity
FROM agent_tool_invocation_log atil
JOIN company c ON atil.company_id = c.id
WHERE atil.created_at > NOW() - INTERVAL '30 days'
GROUP BY c.id, c.name
ORDER BY total_tool_calls DESC;

-- =============================================================================
-- 8. Tool Combination Patterns (Tools Used Together in Same Session)
-- =============================================================================
WITH session_tools AS (
    SELECT
        correlation_id,
        STRING_AGG(DISTINCT tool_name, ' → ' ORDER BY tool_name) as tool_sequence
    FROM agent_tool_invocation_log
    WHERE created_at > NOW() - INTERVAL '7 days'
      AND correlation_id IS NOT NULL
    GROUP BY correlation_id
    HAVING COUNT(*) > 1
)
SELECT
    tool_sequence,
    COUNT(*) as frequency
FROM session_tools
GROUP BY tool_sequence
ORDER BY frequency DESC
LIMIT 20;

-- =============================================================================
-- 9. Detailed Log Export (Last N Records)
-- =============================================================================
-- Export to CSV via psql: \copy (SELECT ...) TO '/path/to/export.csv' CSV HEADER
SELECT
    atil.id,
    atil.created_at,
    atil.tool_name,
    atil.status,
    atil.result_count,
    atil.arguments_json,
    atil.correlation_id,
    u.email as user_email,
    c.name as company_name
FROM agent_tool_invocation_log atil
LEFT JOIN own_user u ON atil.user_id = u.id
LEFT JOIN company c ON atil.company_id = c.id
WHERE atil.created_at > NOW() - INTERVAL '7 days'
ORDER BY atil.created_at DESC;

-- =============================================================================
-- 10. Failed Tool Calls (For Debugging)
-- =============================================================================
SELECT
    atil.id,
    atil.created_at,
    atil.tool_name,
    atil.arguments_json,
    atil.status,
    u.email as user_email,
    atil.correlation_id
FROM agent_tool_invocation_log atil
LEFT JOIN own_user u ON atil.user_id = u.id
WHERE atil.status = 'error'
  AND atil.created_at > NOW() - INTERVAL '24 hours'
ORDER BY atil.created_at DESC;
