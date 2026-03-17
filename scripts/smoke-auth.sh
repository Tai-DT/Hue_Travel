#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8080/api/v1}"
EMAIL="${EMAIL:-}"
PASSWORD="${PASSWORD:-HueTravel123!}"
FULL_NAME="${FULL_NAME:-Smoke Auth User}"

fail() {
  echo "$1" >&2
  exit 1
}

extract_json_string() {
  local json="$1"
  local key="$2"
  printf '%s' "$json" | sed -n "s/.*\"${key}\":\"\\([^\"]*\\)\".*/\\1/p"
}

check_success() {
  local label="$1"
  local payload="$2"

  if [[ "$payload" != *'"success":true'* ]]; then
    fail "${label} failed: ${payload}"
  fi
}

register_if_needed() {
  if [[ -n "$EMAIL" ]]; then
    return 0
  fi

  EMAIL="smoke-auth-$$_$(date +%s)@huetravel.local"

  echo "Registering local account ${EMAIL}..."
  register_payload="$(curl -fsS -X POST "${API_BASE}/auth/register" \
    -H 'Content-Type: application/json' \
    -d "{\"full_name\":\"${FULL_NAME}\",\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")"
  check_success "Register" "$register_payload"
}

echo "Checking API health..."
curl -fsS "${API_BASE%/api/v1}/health" >/dev/null || fail "API is not reachable at ${API_BASE%/api/v1}"

register_if_needed

echo "Logging in with ${EMAIL}..."
login_payload="$(curl -fsS -X POST "${API_BASE}/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")"
check_success "Login" "$login_payload"

access_token="$(extract_json_string "$login_payload" "token")"
refresh_token="$(extract_json_string "$login_payload" "refresh_token")"

[[ -n "$access_token" ]] || fail "Login response did not include access token"
[[ -n "$refresh_token" ]] || fail "Login response did not include refresh token"

echo "Refreshing session..."
refresh_payload="$(curl -fsS -X POST "${API_BASE}/auth/refresh" \
  -H 'Content-Type: application/json' \
  -d "{\"refresh_token\":\"${refresh_token}\"}")"
check_success "Refresh token" "$refresh_payload"

next_access_token="$(extract_json_string "$refresh_payload" "token")"
next_refresh_token="$(extract_json_string "$refresh_payload" "refresh_token")"

[[ -n "$next_access_token" ]] || fail "Refresh response did not include access token"
[[ -n "$next_refresh_token" ]] || fail "Refresh response did not include refresh token"

echo "Logging out..."
logout_payload="$(curl -fsS -X POST "${API_BASE}/auth/logout" \
  -H "Authorization: Bearer ${next_access_token}" \
  -H 'Content-Type: application/json')"
check_success "Logout" "$logout_payload"

echo "Authenticated smoke flow passed for ${EMAIL} via ${API_BASE}"
