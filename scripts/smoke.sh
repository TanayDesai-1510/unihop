#!/usr/bin/env bash
# UniHop golden-path smoke test (docs/contract.md section 13).
#
# Runs against a live backend with the driver simulator on (app.simulator.enabled=true, the default) and
# app.auth.demo-header=true (the default). Needs bash, curl and jq. Works on macOS and Git Bash on Windows.
#
#   scripts/smoke.sh                         # against http://localhost:8080
#   BASE_URL=https://api.example.com scripts/smoke.sh
#
# Safe to re-run against the same database: reuses rider1's saved Mastercard, cancels a leftover active ride,
# and checks credits relative to the balance it finds (a fresh database shows the 5.00 + card split).
# Exits non-zero with a clear message on the first failure.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
RIDE_TIMEOUT_SECONDS="${RIDE_TIMEOUT_SECONDS:-120}"

RIDER1_EMAIL="rider1@scarletmail.rutgers.edu"
RIDER2="00000000-0000-0000-0000-000000000102"
RIDER2_OLD_CARD="00000000-0000-0000-0000-000000000404"   # Visa 0002, behavior CARD_DECLINED (seed)
YARD="00000000-0000-0000-0000-000000000301"
BUSCH_SC="00000000-0000-0000-0000-000000000302"

STEP=""
STATUS=""
BODY=""

fail() {
  echo "" >&2
  echo "FAIL [$STEP] $*" >&2
  if [[ -n "$STATUS" ]]; then
    echo "  last response: HTTP $STATUS" >&2
    echo "  $BODY" | head -c 600 >&2
    echo "" >&2
  fi
  exit 1
}

step() {
  STEP="$1"
  echo "==> $1"
}

ok() {
  echo "    ok: $*"
}

command -v curl >/dev/null || { echo "smoke.sh needs curl" >&2; exit 1; }
command -v jq >/dev/null || { echo "smoke.sh needs jq (macOS: brew install jq; Windows: winget install jqlang.jq)" >&2; exit 1; }

# req METHOD PATH [JSON_BODY] [AUTH]   AUTH is "jwt:<token>" or "demo:<user uuid>". Sets STATUS and BODY.
req() {
  local method="$1" path="$2" data="${3:-}" auth="${4:-}"
  local args=(-sS -X "$method" "$BASE_URL$path" -H "Accept: application/json" -w $'\n%{http_code}')
  case "$auth" in
    jwt:*) args+=(-H "Authorization: Bearer ${auth#jwt:}") ;;
    demo:*) args+=(-H "X-Demo-User: ${auth#demo:}") ;;
  esac
  if [[ -n "$data" ]]; then
    args+=(-H "Content-Type: application/json" --data "$data")
  fi
  local out
  out="$(curl "${args[@]}")" || fail "could not reach $BASE_URL$path"
  STATUS="${out##*$'\n'}"
  BODY="${out%$'\n'*}"
}

expect_status() {
  [[ "$STATUS" == "$1" ]] || fail "expected HTTP $1, got $STATUS"
}

# json FILTER -> prints the value from BODY (raw strings)
json() {
  jq -r "$1" <<<"$BODY"
}

# money A == B (compares as numbers to 2 decimals)
money_eq() {
  [[ "$(printf '%.2f' "$1")" == "$(printf '%.2f' "$2")" ]]
}

money() {
  printf '%.2f' "$1"
}

credits_balance() {
  req GET /api/credits "" "$RIDER1_AUTH"
  expect_status 200
  json '.balance'
}

# ---------------------------------------------------------------------------------------------------------------------
step "0. Backend is up"
req GET /api/health
expect_status 200
[[ "$(json '.status')" == "ok" ]] || fail "health is not ok"
ok "$BASE_URL"

# ---------------------------------------------------------------------------------------------------------------------
step "1. rider1 logs in with OTP"
req POST /api/auth/request-otp "{\"email\":\"$RIDER1_EMAIL\"}"
expect_status 200
OTP="$(json '.devOtp')"
[[ "$OTP" =~ ^[0-9]{6}$ ]] || fail "devOtp is not 6 digits: $OTP"
req POST /api/auth/verify-otp "{\"email\":\"$RIDER1_EMAIL\",\"otp\":\"$OTP\"}"
expect_status 200
TOKEN="$(json '.token')"
RIDER1="$(json '.user.id')"
[[ -n "$TOKEN" && "$TOKEN" != "null" ]] || fail "no token"
RIDER1_AUTH="jwt:$TOKEN"
ok "logged in as $RIDER1"

# A failed earlier run may have left an active ride; cancel it so this run starts clean.
req GET /api/rides/active "" "$RIDER1_AUTH"
if [[ "$STATUS" == "200" ]]; then
  LEFTOVER="$(json '.id')"
  req POST "/api/rides/$LEFTOVER/cancel" '{"reason":"smoke.sh cleanup"}' "$RIDER1_AUTH"
  [[ "$STATUS" == "200" ]] || fail "could not cancel leftover active ride $LEFTOVER"
  ok "cancelled leftover active ride $LEFTOVER"
fi

# ---------------------------------------------------------------------------------------------------------------------
step "2. Tokenize 5555 5555 5555 4444 and save it"
EXP_YEAR=$(( $(date +%Y) + 3 ))
req POST /mockpay/v1/tokens "{\"number\":\"5555 5555 5555 4444\",\"expMonth\":12,\"expYear\":$EXP_YEAR,\"cvc\":\"123\"}"
expect_status 200
CARD_TOKEN="$(json '.token')"
[[ "$(json '.brand')" == "MASTERCARD" && "$(json '.last4')" == "4444" ]] || fail "unexpected token brand/last4"
req POST /api/payment-methods "{\"token\":\"$CARD_TOKEN\",\"nickname\":\"Smoke test\"}" "$RIDER1_AUTH"
if [[ "$STATUS" == "200" || "$STATUS" == "201" ]]; then
  MC_ID="$(json '.id')"
  ok "saved $(json '.label') ($MC_ID)"
elif [[ "$STATUS" == "409" && "$(json '.error')" == "DUPLICATE_PAYMENT_METHOD" ]]; then
  req GET /api/payment-methods "" "$RIDER1_AUTH"
  expect_status 200
  MC_ID="$(json "[.[] | select(.brand == \"MASTERCARD\" and .last4 == \"4444\" and .expYear == $EXP_YEAR)][0].id")"
  [[ -n "$MC_ID" && "$MC_ID" != "null" ]] || fail "409 duplicate but the Mastercard 4444 is not in the list"
  ok "already saved from an earlier run ($MC_ID)"
else
  fail "saving the card failed"
fi
MC_LABEL="Mastercard •••• 4444"

# ---------------------------------------------------------------------------------------------------------------------
step "3. Quote The Yard -> Busch Student Center"
req GET "/api/fares/quote?from=$YARD&to=$BUSCH_SC" "" "$RIDER1_AUTH"
expect_status 200
FARE="$(json '.total')"
PAYOUT="$(json '.driverPayout')"
money_eq "$FARE" 6.50 || fail "expected fare 6.50 (COLLEGE_AVE -> BUSCH), got $FARE"
money_eq "$PAYOUT" 4.50 || fail "expected driverPayout 4.50, got $PAYOUT"
ok "total $(money "$FARE"), driverPayout $(money "$PAYOUT")"

# ---------------------------------------------------------------------------------------------------------------------
step "4. Request with useCredits=true: credits first, remainder on the card"
BALANCE_BEFORE="$(credits_balance)"
EXPECT_CREDITS="$(jq -n --argjson b "$BALANCE_BEFORE" --argjson f "$FARE" 'if $b < $f then $b else $f end')"
EXPECT_CARD="$(jq -n --argjson c "$EXPECT_CREDITS" --argjson f "$FARE" '$f - $c')"
req POST /api/rides "{\"pickupHubId\":\"$YARD\",\"dropoffHubId\":\"$BUSCH_SC\",\"paymentMethodId\":\"$MC_ID\",\"useCredits\":true}" "$RIDER1_AUTH"
expect_status 201
RIDE="$(json '.id')"
[[ "$(json '.status')" == "REQUESTED" ]] || fail "new ride is not REQUESTED"
[[ "$(json '.payment.status')" == "AUTHORIZED" ]] || fail "payment is not AUTHORIZED"
money_eq "$(json '.payment.creditsApplied')" "$EXPECT_CREDITS" \
  || fail "creditsApplied $(json '.payment.creditsApplied'), expected $(money "$EXPECT_CREDITS") (balance was $(money "$BALANCE_BEFORE"))"
money_eq "$(json '.payment.cardAmount')" "$EXPECT_CARD" \
  || fail "cardAmount $(json '.payment.cardAmount'), expected $(money "$EXPECT_CARD")"
METHOD_LABEL="$(json '.payment.methodLabel')"
if money_eq "$EXPECT_CREDITS" 0; then
  [[ "$METHOD_LABEL" == "$MC_LABEL" ]] || fail "methodLabel '$METHOD_LABEL', expected '$MC_LABEL'"
  ok "no credits left (balance 0.00); whole fare on the card. Reset the database to see the split."
elif money_eq "$EXPECT_CARD" 0; then
  [[ "$METHOD_LABEL" == "UniHop Cash" ]] || fail "methodLabel '$METHOD_LABEL', expected 'UniHop Cash'"
else
  [[ "$METHOD_LABEL" == "UniHop Cash + $MC_LABEL" ]] || fail "methodLabel '$METHOD_LABEL', expected 'UniHop Cash + $MC_LABEL'"
fi
money_eq "$(credits_balance)" "$(jq -n --argjson b "$BALANCE_BEFORE" --argjson c "$EXPECT_CREDITS" '$b - $c')" \
  || fail "credit balance did not drop by creditsApplied while the ride is held"
ok "ride $RIDE: $METHOD_LABEL, credits $(money "$EXPECT_CREDITS") + card $(money "$EXPECT_CARD")"

# ---------------------------------------------------------------------------------------------------------------------
step "5. Simulated driver accepts, arrives, starts with PIN, completes"
DRIVER=""
EARNINGS_BEFORE=""
LAST_SEEN=""
DEADLINE=$(( $(date +%s) + RIDE_TIMEOUT_SECONDS ))
while :; do
  req GET "/api/rides/$RIDE" "" "$RIDER1_AUTH"
  expect_status 200
  RIDE_STATUS="$(json '.status')"
  if [[ "$RIDE_STATUS" != "$LAST_SEEN" ]]; then
    ok "$RIDE_STATUS"
    LAST_SEEN="$RIDE_STATUS"
  fi
  if [[ -z "$DRIVER" && "$(json '.driver.id')" != "null" ]]; then
    DRIVER="$(json '.driver.id')"
    [[ "$(json '.pin')" =~ ^[0-9]{4}$ ]] || fail "rider does not see a 4-digit PIN after accept"
    req GET /api/me/earnings "" "demo:$DRIVER"
    expect_status 200
    EARNINGS_BEFORE="$(json '.total')"
    ok "driver $DRIVER assigned, earnings total before: $(money "$EARNINGS_BEFORE")"
    continue
  fi
  case "$RIDE_STATUS" in
    COMPLETED) break ;;
    CANCELLED|NO_DRIVERS) fail "ride ended as $RIDE_STATUS (is the simulator on and are seeded drivers online?)" ;;
  esac
  (( $(date +%s) < DEADLINE )) || fail "ride still $RIDE_STATUS after ${RIDE_TIMEOUT_SECONDS}s (is app.simulator.enabled=true?)"
  sleep 1
done
[[ -n "$DRIVER" ]] || fail "ride completed without the rider ever seeing a driver"

# ---------------------------------------------------------------------------------------------------------------------
step "6. Payment captured, driver paid, receipt shows the method, rating submitted"
[[ "$(json '.payment.status')" == "CAPTURED" ]] || fail "payment is $(json '.payment.status'), expected CAPTURED"
ok "payment CAPTURED"

req GET /api/me/earnings "" "demo:$DRIVER"
expect_status 200
EARNINGS_AFTER="$(json '.total')"
money_eq "$(jq -n --argjson a "$EARNINGS_AFTER" --argjson b "$EARNINGS_BEFORE" '$a - $b')" "$PAYOUT" \
  || fail "driver earnings went $(money "$EARNINGS_BEFORE") -> $(money "$EARNINGS_AFTER"), expected +$(money "$PAYOUT")"
ok "driver earnings +$(money "$PAYOUT")"

req GET "/api/rides/$RIDE/receipt" "" "$RIDER1_AUTH"
expect_status 200
[[ "$(json '.payment.methodLabel')" == "$METHOD_LABEL" ]] \
  || fail "receipt methodLabel '$(json '.payment.methodLabel')', expected '$METHOD_LABEL'"
money_eq "$(json '.fare.total')" "$FARE" || fail "receipt total $(json '.fare.total'), expected $FARE"
ok "receipt: $METHOD_LABEL, $(money "$FARE")"

req POST "/api/rides/$RIDE/rating" '{"stars":5,"comment":"smoke.sh"}' "$RIDER1_AUTH"
if [[ "$STATUS" == "204" ]]; then
  ok "rated the driver 5 stars"
else
  fail "rating returned HTTP $STATUS, expected 204"
fi

# ---------------------------------------------------------------------------------------------------------------------
step "7. Declined card: 402 CARD_DECLINED and no ride"
req GET /api/rides/active "" "demo:$RIDER2"
[[ "$STATUS" == "204" ]] || fail "rider2 already has an active ride; cancel it and re-run"
req POST /api/rides "{\"pickupHubId\":\"$YARD\",\"dropoffHubId\":\"$BUSCH_SC\",\"paymentMethodId\":\"$RIDER2_OLD_CARD\",\"useCredits\":false}" "demo:$RIDER2"
expect_status 402
[[ "$(json '.error')" == "PAYMENT_DECLINED" ]] || fail "error $(json '.error'), expected PAYMENT_DECLINED"
[[ "$(json '.declineCode')" == "CARD_DECLINED" ]] || fail "declineCode $(json '.declineCode'), expected CARD_DECLINED"
req GET /api/rides/active "" "demo:$RIDER2"
[[ "$STATUS" == "204" ]] || fail "a ride exists for rider2 after a declined request"
ok "402 PAYMENT_DECLINED / CARD_DECLINED, no ride created"

# ---------------------------------------------------------------------------------------------------------------------
step "8. Request then cancel: payment VOIDED, credits restored"
BALANCE_BEFORE="$(credits_balance)"
if money_eq "$BALANCE_BEFORE" 0; then
  # Step 4 spent the credits; top up so the cancel has credits to give back.
  req POST /api/credits/topup "{\"amount\":10,\"paymentMethodId\":\"$MC_ID\"}" "$RIDER1_AUTH"
  expect_status 200
  BALANCE_BEFORE="$(json '.balance')"
  ok "topped up UniHop Cash to $(money "$BALANCE_BEFORE") with the Mastercard"
fi
req POST /api/rides "{\"pickupHubId\":\"$YARD\",\"dropoffHubId\":\"$BUSCH_SC\",\"paymentMethodId\":\"$MC_ID\",\"useCredits\":true}" "$RIDER1_AUTH"
expect_status 201
CANCEL_RIDE="$(json '.id')"
HELD="$(json '.payment.creditsApplied')"
[[ "$(jq -n --argjson h "$HELD" '$h > 0')" == "true" ]] \
  || fail "no credits were applied to the ride, so the refund cannot be checked"
money_eq "$(credits_balance)" "$(jq -n --argjson b "$BALANCE_BEFORE" --argjson h "$HELD" '$b - $h')" \
  || fail "credit balance did not drop by the $(money "$HELD") held for the ride"
req POST "/api/rides/$CANCEL_RIDE/cancel" '{"reason":"smoke.sh cancel check"}' "$RIDER1_AUTH"
expect_status 200
[[ "$(json '.status')" == "CANCELLED" ]] || fail "ride is $(json '.status') after cancel"
[[ "$(json '.cancelledBy')" == "RIDER" ]] || fail "cancelledBy $(json '.cancelledBy'), expected RIDER"
[[ "$(json '.payment.status')" == "VOIDED" ]] || fail "payment is $(json '.payment.status'), expected VOIDED"
BALANCE_AFTER="$(credits_balance)"
money_eq "$BALANCE_AFTER" "$BALANCE_BEFORE" \
  || fail "credits $(money "$BALANCE_BEFORE") before, $(money "$BALANCE_AFTER") after cancel; expected them restored"
ok "VOIDED, $(money "$HELD") credits refunded, balance back to $(money "$BALANCE_AFTER")"

echo ""
echo "PASS: golden path verified against $BASE_URL"
