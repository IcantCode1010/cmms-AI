#!/bin/sh
set -e

escape() {
  printf '%s' "$1" | sed "s/'/\\'/g"
}

write_runtime_config() {
  cat <<EOF > /usr/share/nginx/html/runtime-env.js
(function setRuntimeConfig() {
  const existing = window.__RUNTIME_CONFIG__ || {};
  window.__RUNTIME_CONFIG__ = {
    ...existing,
    CLOUD_VERSION: '$(escape "${CLOUD_VERSION:-false}")',
    INVITATION_VIA_EMAIL: '$(escape "${INVITATION_VIA_EMAIL:-false}")',
    GOOGLE_TRACKING_ID: '$(escape "${GOOGLE_TRACKING_ID:-}")',
    GOOGLE_KEY: '$(escape "${GOOGLE_KEY:-}")',
    API_URL: '$(escape "${API_URL:-http://localhost:8080}")',
    NODE_ENV: '$(escape "${NODE_ENV:-production}")',
    MUI_X_LICENSE: '$(escape "${MUI_X_LICENSE:-}")',
    ENABLE_SSO: '$(escape "${ENABLE_SSO:-false}")',
    OAUTH2_PROVIDER: '$(escape "${OAUTH2_PROVIDER:-}")',
    LOGO_PATHS: '$(escape "${LOGO_PATHS:-}")',
    CUSTOM_COLORS: '$(escape "${CUSTOM_COLORS:-}")',
    BRAND_CONFIG: '$(escape "${BRAND_CONFIG:-}")',
    CHATKIT_ENABLED: '$(escape "${CHATKIT_ENABLED:-false}")',
    CHATKIT_AGENT_ID: '$(escape "${CHATKIT_AGENT_ID:-}")',
    AGENT_API_BASE: '$(escape "${AGENT_API_BASE:-http://localhost:8080}")',
    REACT_APP_AI_BROWSER_ENABLED: '$(escape "${REACT_APP_AI_BROWSER_ENABLED:-true}")',
    REACT_APP_ORCHESTRATOR_AGENT_ID: '$(escape "${REACT_APP_ORCHESTRATOR_AGENT_ID:-atlas.orchestrator}")',
    REACT_APP_OPENAI_MODEL_INTENT: '$(escape "${REACT_APP_OPENAI_MODEL_INTENT:-gpt-4.1-mini}")',
    REACT_APP_INTENT_SSE_TIMEOUT: '$(escape "${REACT_APP_INTENT_SSE_TIMEOUT:-30000}")'
  };
})();
EOF
}

write_runtime_config
exec "$@"
