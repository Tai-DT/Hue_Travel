#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8080/api/v1}"
PHONE="${PHONE:-0900000000}"
OTP_CODE="${OTP_CODE:-${DEV_FIXED_OTP:-123456}}"

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

echo "Checking API health..."
curl -fsS "${API_BASE%/api/v1}/health" >/dev/null || fail "API is not reachable at ${API_BASE%/api/v1}"

echo "Sending OTP to ${PHONE}..."
send_payload="$(curl -fsS -X POST "${API_BASE}/auth/otp/send" \
  -H 'Content-Type: application/json' \
  -d "{\"phone\":\"${PHONE}\"}")"
check_success "Send OTP" "$send_payload"

echo "Verifying OTP..."
verify_payload="$(curl -fsS -X POST "${API_BASE}/auth/otp/verify" \
  -H 'Content-Type: application/json' \
  -d "{\"phone\":\"${PHONE}\",\"code\":\"${OTP_CODE}\"}")"
check_success "Verify OTP" "$verify_payload"

access_token="$(extract_json_string "$verify_payload" "token")"
refresh_token="$(extract_json_string "$verify_payload" "refresh_token")"

[[ -n "$access_token" ]] || fail "Verify OTP response did not include access token"
[[ -n "$refresh_token" ]] || fail "Verify OTP response did not include refresh token"

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

echo "Authenticated smoke flow passed for ${PHONE} via ${API_BASE}"
