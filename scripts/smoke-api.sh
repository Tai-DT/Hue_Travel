#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8080}"

check_json_endpoint() {
  local path="$1"
  local response

  response="$(curl -fsS "${API_BASE}${path}")"
  if [[ "$response" != *'"success":true'* ]]; then
    echo "Endpoint ${path} did not return success=true"
    exit 1
  fi
}

echo "Checking API health..."
check_json_endpoint "/health"

echo "Checking API public endpoints..."
check_json_endpoint "/api/v1/docs"
check_json_endpoint "/api/v1/payment/methods"
check_json_endpoint "/api/v1/search/trending"
check_json_endpoint "/api/v1/search/stats"

echo "API smoke check passed for ${API_BASE}"
