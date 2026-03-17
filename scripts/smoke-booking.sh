#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8080/api/v1}"
EMAIL="${EMAIL:-}"
PASSWORD="${PASSWORD:-HueTravel123!}"
FULL_NAME="${FULL_NAME:-Smoke Booking User}"
START_TIME="${START_TIME:-09:00}"
GUEST_COUNT="${GUEST_COUNT:-1}"
BANK_CODE="${BANK_CODE:-}"
EXPERIENCE_ID="${EXPERIENCE_ID:-}"
EXPERIENCE_QUERY="${EXPERIENCE_QUERY:-Food Tour Test}"
BOOKING_OFFSET_DAYS="${BOOKING_OFFSET_DAYS:-$(( (RANDOM % 14) + 1 ))}"

fail() {
  echo "$1" >&2
  exit 1
}

json_get() {
  local expr="$1"
  local json="$2"

  printf '%s' "$json" | node -e '
const fs = require("fs");
const input = fs.readFileSync(0, "utf8");
const expr = process.argv[1];
const data = JSON.parse(input);
const value = Function("data", "return (" + expr + ");")(data);
if (value === undefined || value === null) {
  process.exit(1);
}
process.stdout.write(typeof value === "string" ? value : JSON.stringify(value));
' "$expr" 2>/dev/null || true
}

url_encode() {
  node -e 'process.stdout.write(encodeURIComponent(process.argv[1] || ""));' "$1"
}

date_plus_days() {
  node -e '
const [dateString, deltaString] = process.argv.slice(1);
const date = new Date(`${dateString}T12:00:00`);
if (Number.isNaN(date.getTime())) {
  process.exit(1);
}
date.setDate(date.getDate() + Number(deltaString));
const year = String(date.getFullYear());
const month = String(date.getMonth() + 1).padStart(2, "0");
const day = String(date.getDate()).padStart(2, "0");
process.stdout.write(`${year}-${month}-${day}`);
' "$1" "$2"
}

default_booking_date() {
  node -e '
const date = new Date();
date.setDate(date.getDate() + Number(process.argv[1]));
const year = String(date.getFullYear());
const month = String(date.getMonth() + 1).padStart(2, "0");
const day = String(date.getDate()).padStart(2, "0");
process.stdout.write(`${year}-${month}-${day}`);
' "$1"
}

check_success() {
  local label="$1"
  local payload="$2"
  local success

  success="$(json_get 'data.success' "$payload")"
  if [[ "$success" != "true" ]]; then
    fail "${label} failed: ${payload}"
  fi
}

api_request() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local token="${4:-}"
  local response
  local curl_args=(-sS -X "$method" "$url")

  if [[ -n "$body" ]]; then
    curl_args+=(-H 'Content-Type: application/json' -d "$body")
  fi
  if [[ -n "$token" ]]; then
    curl_args+=(-H "Authorization: Bearer ${token}")
  fi

  if ! response="$(curl "${curl_args[@]}" -w $'\n%{http_code}')"; then
    fail "Request failed: ${method} ${url}"
  fi

  HTTP_STATUS="${response##*$'\n'}"
  HTTP_BODY="${response%$'\n'*}"
}

check_status() {
  local label="$1"
  shift

  for expected in "$@"; do
    if [[ "$HTTP_STATUS" == "$expected" ]]; then
      return 0
    fi
  done

  fail "${label} returned HTTP ${HTTP_STATUS}: ${HTTP_BODY}"
}

register_if_needed() {
  if [[ -n "$EMAIL" ]]; then
    return 0
  fi

  EMAIL="smoke-booking-$$_$(date +%s)@huetravel.local"

  echo "Registering local traveler ${EMAIL}..."
  api_request POST "${API_BASE}/auth/register" \
    "{\"full_name\":\"${FULL_NAME}\",\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}"
  check_status "Register" 201
  check_success "Register" "$HTTP_BODY"
}

BOOKING_DATE="${BOOKING_DATE:-$(default_booking_date "$BOOKING_OFFSET_DAYS")}"

echo "Checking API health..."
curl -fsS "${API_BASE%/api/v1}/health" >/dev/null || fail "API is not reachable at ${API_BASE%/api/v1}"

register_if_needed

echo "Logging in with ${EMAIL}..."
api_request POST "${API_BASE}/auth/login" "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}"
check_status "Login" 200
check_success "Login" "$HTTP_BODY"

access_token="$(json_get 'data.data.token ?? ""' "$HTTP_BODY")"
refresh_token="$(json_get 'data.data.refresh_token ?? ""' "$HTTP_BODY")"

[[ -n "$access_token" ]] || fail "Login response did not include access token"
[[ -n "$refresh_token" ]] || fail "Login response did not include refresh token"

if [[ -z "$EXPERIENCE_ID" ]]; then
  echo "Finding an active experience..."
  encoded_query="$(url_encode "$EXPERIENCE_QUERY")"
  api_request GET "${API_BASE}/experiences?per_page=5&q=${encoded_query}"
  check_status "List experiences" 200
  check_success "List experiences" "$HTTP_BODY"

  EXPERIENCE_ID="$(json_get 'data.data[0]?.id ?? ""' "$HTTP_BODY")"
  EXPERIENCE_TITLE="$(json_get 'data.data[0]?.title ?? ""' "$HTTP_BODY")"

  if [[ -z "$EXPERIENCE_ID" ]]; then
    api_request GET "${API_BASE}/experiences?per_page=1"
    check_status "List fallback experiences" 200
    check_success "List fallback experiences" "$HTTP_BODY"

    EXPERIENCE_ID="$(json_get 'data.data[0]?.id ?? ""' "$HTTP_BODY")"
    EXPERIENCE_TITLE="$(json_get 'data.data[0]?.title ?? ""' "$HTTP_BODY")"
  fi

  [[ -n "$EXPERIENCE_ID" ]] || fail "No active experiences found. Seed demo data with 'make seed' first."
else
  EXPERIENCE_TITLE="manual:${EXPERIENCE_ID}"
fi

echo "Using experience ${EXPERIENCE_TITLE} (${EXPERIENCE_ID})..."

attempt_date="$BOOKING_DATE"
booking_payload=""
for _attempt in 1 2 3 4 5; do
  request_body="$(printf '{"experience_id":"%s","booking_date":"%s","start_time":"%s","guest_count":%s,"special_notes":"Smoke booking flow"}' \
    "$EXPERIENCE_ID" "$attempt_date" "$START_TIME" "$GUEST_COUNT")"

  echo "Creating booking for ${attempt_date}..."
  api_request POST "${API_BASE}/bookings" "$request_body" "$access_token"

  if [[ "$HTTP_STATUS" == "201" ]]; then
    check_success "Create booking" "$HTTP_BODY"
    booking_payload="$HTTP_BODY"
    BOOKING_DATE="$attempt_date"
    break
  fi

  if [[ "$HTTP_STATUS" != "400" ]]; then
    fail "Create booking returned HTTP ${HTTP_STATUS}: ${HTTP_BODY}"
  fi

  attempt_date="$(date_plus_days "$attempt_date" 1)"
done

[[ -n "$booking_payload" ]] || fail "Could not create booking after several date attempts: ${HTTP_BODY}"

booking_id="$(json_get 'data.data.booking.id ?? ""' "$booking_payload")"
booking_status="$(json_get 'data.data.booking.status ?? ""' "$booking_payload")"

[[ -n "$booking_id" ]] || fail "Create booking response did not include booking ID"
[[ "$booking_status" == "pending" ]] || fail "Expected new booking to be pending, got: ${booking_status}"

if [[ -n "$BANK_CODE" ]]; then
  payment_body="$(printf '{"booking_id":"%s","bank_code":"%s"}' "$booking_id" "$BANK_CODE")"
else
  payment_body="$(printf '{"booking_id":"%s"}' "$booking_id")"
fi

echo "Creating payment for booking ${booking_id}..."
api_request POST "${API_BASE}/payment/create" "$payment_body" "$access_token"
check_status "Create payment" 200
check_success "Create payment" "$HTTP_BODY"

payment_url="$(json_get 'data.data.payment_url ?? ""' "$HTTP_BODY")"
txn_ref="$(json_get 'data.data.txn_ref ?? ""' "$HTTP_BODY")"
payment_status="$(json_get 'data.data.status ?? ""' "$HTTP_BODY")"

[[ -n "$payment_url" ]] || fail "Create payment response did not include payment URL"
[[ -n "$txn_ref" ]] || fail "Create payment response did not include transaction ref"

if [[ "$payment_status" == "success" ]]; then
  echo "Mock payment succeeded, verifying booking status..."
  api_request GET "${API_BASE}/bookings/${booking_id}" "" "$access_token"
  check_status "Get booking" 200
  check_success "Get booking" "$HTTP_BODY"

  final_status="$(json_get 'data.data.status ?? ""' "$HTTP_BODY")"
  [[ "$final_status" == "confirmed" ]] || fail "Expected confirmed booking after mock payment, got: ${final_status}"
else
  echo "Payment URL created. Complete the gateway callback separately if VNPay is configured."
fi

echo "Logging out..."
api_request POST "${API_BASE}/auth/logout" "" "$access_token"
check_status "Logout" 200
check_success "Logout" "$HTTP_BODY"

echo "Booking + payment smoke flow passed for ${EMAIL} on ${BOOKING_DATE} via ${API_BASE}"
