# UniHop Contract

Source of truth for every API, DB table, WebSocket event, and cross-team interface.
Java DTOs/enums and `frontend/src/lib/types.ts` must match this file exactly.
Nobody changes this file without the team agreeing out loud first. Change the contract first, then the code.

---

## 1. Cross-team interfaces (frozen signatures)

These are the only places Hriday's and Dev's code touch. Stubs exist from the scaffold, so neither side ever waits on the other.

| Interface | Owner | Called by | Notes |
|---|---|---|---|
| `com.unihop.common.CurrentUser.id(): UUID` | Hriday | everyone | JWT subject. Falls back to `X-Demo-User` header (a user UUID) only when `app.auth.demo-header=true`. Throws 401 `UNAUTHORIZED` when neither is present. |
| `com.unihop.pricing.FareService.quote(UUID fromHubId, UUID toHubId): FareBreakdown` | Hriday | Dev (ride creation) | Throws 404 `HUB_NOT_FOUND`, 400 `SAME_HUB`. |
| `com.unihop.payments.PaymentService.authorizeRide(UUID rideId, UUID riderId, UUID paymentMethodId /* nullable = default */, boolean useCredits, BigDecimal amount): PaymentSummary` | Hriday | Dev, inside the ride-creation transaction | Throws `PaymentDeclinedException(declineCode)` or `PaymentMethodRequiredException`; both map to 402 and the ride is rolled back. |
| `com.unihop.payments.PaymentService.captureRide(UUID rideId): void` | Hriday | Dev, when a ride becomes COMPLETED | Captures the card hold, finalizes credits, adds the driver's RIDE_EARNING. Idempotent. |
| `com.unihop.payments.PaymentService.voidRide(UUID rideId): void` | Hriday | Dev, on CANCELLED or NO_DRIVERS | Releases the hold and restores credits. Idempotent. |

Supporting types (also frozen): `com.unihop.pricing.FareBreakdown`, `com.unihop.payments.PaymentSummary`, `com.unihop.payments.PaymentDeclinedException` (carries `DeclineCode declineCode`), `com.unihop.payments.PaymentMethodRequiredException`, and all enums in `com.unihop.common.enums`.

Claude assistant ownership: Hriday owns `backend/src/**/com/unihop/assistant/**` and its tests. Tanay owns the assistant UI and client-side action runner in `frontend/**`. The assistant may return a bounded command, but all state-changing work still goes through the existing authenticated REST endpoints below.

Voice (ElevenLabs) ownership: Dev owns `backend/src/**/com/unihop/voice/**` and its tests. Tanay owns audio capture, playback and the driver announcement UI in `frontend/**`. Voice never changes the assistant contract: the frontend sends the transcript to `POST /api/assistant/commands` exactly like typed input.

Scaffold state: `CurrentUser` works with `X-Demo-User`. `FareService` is fully implemented against the `fares` table. `PaymentService` is a stub (`StubPaymentService`): authorize always succeeds, capture/void log and do nothing. Hriday replaces the stub.

---

## 2. Conventions

- JSON is camelCase. IDs are UUID strings. Money is a JSON number with 2 decimals (`BigDecimal` in Java, `number` in TS). Timestamps are ISO-8601 UTC strings (`2026-10-11T14:30:00Z`).
- Errors: HTTP status plus `{ "error": "CODE", "message": "human readable" }`. 402 `PAYMENT_DECLINED` adds `"declineCode"`.
- Auth: `Authorization: Bearer <jwt>` on all `/api/**` except `/api/auth/**`, `/api/health`, `/api/hubs`, `/api/share/**`. `/mockpay/**`, `/ws`, `/swagger-ui/**`, `/v3/api-docs/**`, `/actuator/health` are also public.
- JWT: HS256 signed with `app.jwt.secret` (`JWT_SECRET`), `sub` = user id (UUID string), 7-day expiry.
- Demo header: when `app.auth.demo-header=true`, a request with `X-Demo-User: <user uuid>` and no JWT is treated as that user. Used for backend testing and `smoke.sh`.
- All user actions go through REST. The server pushes updates over WebSocket. Clients never send WS messages.
- Nullable fields are always present in JSON with `null` (never omitted), except `declineCode` on non-402 errors.

### Error codes

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Malformed body, missing field, bean validation failure |
| 400 | `INVALID_EMAIL_DOMAIN` | Email is not `@scarletmail.rutgers.edu` |
| 400 | `INVALID_OTP` | Wrong or expired OTP |
| 400 | `SAME_HUB` | Pickup and dropoff are the same hub |
| 400 | `INVALID_PIN` | Wrong ride PIN on start |
| 400 | `INVALID_NUMBER` / `INVALID_EXPIRY` / `INVALID_CVC` | Mock processor tokenization rejects the card |
| 400 | `INVALID_PROMO_CODE` | Stretch: unknown or inactive promo code |
| 401 | `UNAUTHORIZED` | No valid JWT (and no demo header when enabled) |
| 402 | `PAYMENT_DECLINED` | Gateway declined; body includes `declineCode` |
| 402 | `PAYMENT_METHOD_REQUIRED` | No usable payment method and credits do not cover the fare |
| 403 | `FORBIDDEN` | Caller is not a participant / not the driver holding the offer |
| 404 | `NOT_FOUND` | Generic missing resource |
| 404 | `HUB_NOT_FOUND` | Unknown hub id |
| 409 | `INVALID_TRANSITION` | Ride state change not allowed |
| 409 | `DRIVER_NOT_ONBOARDED` | Switching to DRIVER mode / going online without an APPROVED profile |
| 409 | `ACTIVE_RIDE_EXISTS` | Rider requests a ride while they already have a non-terminal ride |
| 409 | `OFFER_NOT_ACTIVE` | Accept/decline on an offer that expired, was revoked, or was already answered |
| 409 | `DUPLICATE_PAYMENT_METHOD` | Same brand + last4 + expiry already saved |
| 409 | `PAYMENT_METHOD_IN_USE` | Deleting a method that holds an active authorization |
| 409 | `ALREADY_RATED` | Rater already rated this ride |
| 409 | `NOTHING_TO_CASH_OUT` | Earnings balance is 0 |
| 503 | `ASSISTANT_UNAVAILABLE` | Claude is disabled, unavailable, times out, or returns an invalid response |
| 503 | `VOICE_UNAVAILABLE` | ElevenLabs is not configured, unavailable, times out, is out of credits, or returns an invalid response |
| 500 | `INTERNAL_ERROR` | Anything unexpected |

---

## 3. Enums

| Enum | Values |
|---|---|
| `RideStatus` | REQUESTED, ACCEPTED, ARRIVED, IN_PROGRESS, COMPLETED, CANCELLED, NO_DRIVERS |
| `OfferStatus` | OFFERED, ACCEPTED, DECLINED, EXPIRED |
| `UserMode` | RIDER, DRIVER |
| `DriverStatus` | PENDING, APPROVED |
| `Zone` | COLLEGE_AVE, BUSCH, LIVINGSTON, COOK_DOUGLASS, DOWNTOWN |
| `PaymentMethodType` | CARD, APPLE_PAY, GOOGLE_PAY |
| `CardBrand` | VISA, MASTERCARD, AMEX, DISCOVER |
| `PaymentStatus` | AUTHORIZED, CAPTURED, VOIDED, FAILED |
| `DeclineCode` | CARD_DECLINED, INSUFFICIENT_FUNDS, EXPIRED_CARD, INCORRECT_CVC |
| `CreditTxnType` | PROMO, TOPUP, RIDE_SPEND, RIDE_REFUND |
| `EarningTxnType` | RIDE_EARNING, PAYOUT |
| `AssistantAction` | BOOK_RIDE, WATCH_RIDES, STOP_WATCHING, HELP |

Ride status transitions (anything else returns 409 `INVALID_TRANSITION`):

```
REQUESTED   -> ACCEPTED | CANCELLED | NO_DRIVERS
ACCEPTED    -> ARRIVED | CANCELLED
ARRIVED     -> IN_PROGRESS | CANCELLED
IN_PROGRESS -> COMPLETED
```

Terminal statuses: COMPLETED, CANCELLED, NO_DRIVERS. "Active ride" means any non-terminal status.

`cancelledBy` on a ride is a plain string: `"RIDER"`, `"DRIVER"`, or `"SYSTEM"` (null unless cancelled). NO_DRIVERS rides have `cancelledBy = "SYSTEM"`.

---

## 4. Pricing rules

- Fare comes from a symmetric zone-to-zone table keyed by the pickup hub's zone and the dropoff hub's zone. Every fare is under $10.
- `platformFee = 1.50`, `baseFare = total - 1.50`, `driverPayout = 90% of baseFare`, `platformMargin = total - driverPayout`. Round to 2 decimals, HALF_UP.
- Pickup and dropoff hubs must differ (400 `SAME_HUB`). Two different hubs in the same zone (Cook and Douglass) use the diagonal price.

| From / To | COLLEGE_AVE | BUSCH | LIVINGSTON | COOK_DOUGLASS | DOWNTOWN |
|---|---|---|---|---|---|
| COLLEGE_AVE | 4.50 | 6.50 | 6.50 | 6.50 | 4.50 |
| BUSCH | | 4.50 | 5.50 | 8.50 | 6.50 |
| LIVINGSTON | | | 4.50 | 8.50 | 6.50 |
| COOK_DOUGLASS | | | | 4.50 | 5.50 |
| DOWNTOWN | | | | | 4.50 |

Worked examples: total 4.50 gives baseFare 3.00, driverPayout 2.70, platformMargin 1.80. Total 8.50 gives baseFare 7.00, driverPayout 6.30, platformMargin 2.20.

---

## 5. Payments model

A mock gateway that behaves like a real processor. Riders save multiple payment methods (cards, Apple Pay, Google Pay), pick one per ride, and have UniHop Cash credits. Nothing touches a real processor, but every flow behaves like one so it can be swapped for Stripe by replacing one class.

### Architecture
- `mockpay` package simulates an external payment processor. It is the only code that ever sees a raw card number. It lives under `/mockpay/v1/**`, is public (like a real processor's tokenization API), and adds `app.mockpay.latency-ms` (default 800) of artificial delay to every call so loading states look real.
- `payments` package is UniHop's own billing: saved methods, authorizations, captures, voids, credits, driver earnings. It only ever stores tokens, brand, last4, and expiry.
- `PaymentGateway` interface (`authorize`, `capture`, `voidAuthorization`, `payout`) with `MockPaymentGateway` as the only implementation. A `StripePaymentGateway` could replace it later.
- PCI-style rule: raw card numbers and CVCs are sent only from the frontend to `/mockpay/v1/tokens`, never to `/api/**`, never logged, never stored. The vault stores token, brand, last4, expiry, wallet type, and test behavior only.

### PaymentGateway signatures

`com.unihop.payments.PaymentGateway` is owned by Hriday and implemented by `MockPaymentGateway`:

```java
String authorize(String token, BigDecimal amount, String idempotencyKey);
void capture(String chargeId);
void voidAuthorization(String chargeId);
String payout(String token, BigDecimal amount, String idempotencyKey);
```

`token` is a vault token, never a raw card number. `authorize` returns the gateway charge ID;
`capture` and `voidAuthorization` act on that ID. `payout` returns the gateway payout ID.
The caller supplies the idempotency key for authorization and payout; repeating the same
operation with that key returns the original ID without creating another charge or payout.
Capture and void are idempotent by charge ID. Authorization declines throw the existing
`PaymentDeclinedException` carrying the test card's `DeclineCode`.

### Ride payment lifecycle (same as Uber)
1. **Request**: `authorizeRide` holds the fare. If `useCredits` is true, UniHop Cash covers as much of the fare as possible first (a `RIDE_SPEND` credit transaction for `-creditsApplied` is written immediately, so the balance shows the hold), and only the remainder (`cardAmount`) is authorized on the card. If credits cover everything, no card is needed and `paymentMethodId` is null. A decline means the ride is not created and the API returns 402 `PAYMENT_DECLINED` with `declineCode`.
2. **Completed**: `captureRide` captures the card hold (status CAPTURED) and writes the driver's `RIDE_EARNING` for `driverPayout`. Credits were already debited in step 1, so no new credit entry.
3. **Cancelled or NO_DRIVERS**: `voidRide` voids the card authorization (status VOIDED) and writes a `RIDE_REFUND` credit transaction for `+creditsApplied` if any. The rider is never charged.
4. All three operations are idempotent per ride. Gateway calls use the ride id as the idempotency key.
- `paymentMethodId` null means "use the rider's default method".
- Rider has no payment method and credits do not cover the fare (or `useCredits` is false): 402 `PAYMENT_METHOD_REQUIRED`.
- `PaymentSummary.methodLabel`: the method label (`"Visa •••• 4242"`, `"Apple Pay"`), `"UniHop Cash"` when credits cover everything, `"UniHop Cash + Visa •••• 4242"` when split.

### Payment method labels
`"<Brand> •••• <last4>"` with brand display names Visa, Mastercard, Amex, Discover (e.g. `"Visa •••• 4242"`). Wallet methods are labelled `"Apple Pay"` or `"Google Pay"`. The bullet is U+2022.

### Test cards (Luhn-valid, tokenization decides behavior from the number)

| Number | Brand | Behavior on authorize |
|---|---|---|
| 4242 4242 4242 4242 | VISA | Success |
| 5555 5555 5555 4444 | MASTERCARD | Success |
| 3782 822463 10005 | AMEX | Success (4-digit CVC) |
| 6011 1111 1111 1117 | DISCOVER | Success |
| 4000 0000 0000 0002 | VISA | Declined, `CARD_DECLINED` |
| 4000 0000 0000 9995 | VISA | Declined, `INSUFFICIENT_FUNDS` |
| 4000 0000 0000 0069 | VISA | Declined, `EXPIRED_CARD` |
| 4000 0000 0000 0127 | VISA | Declined, `INCORRECT_CVC` |

Any other Luhn-valid number succeeds with brand detected from its prefix (4 = VISA; 51-55 or 2221-2720 = MASTERCARD; 34/37 = AMEX; 6011, 65, 644-649 = DISCOVER; anything else is 400 `INVALID_NUMBER`). Invalid Luhn or wrong length: 400 `INVALID_NUMBER`. Expiry in the past or month not 1-12: 400 `INVALID_EXPIRY`. CVC not 3 digits (4 for AMEX): 400 `INVALID_CVC`.

Declines happen at authorize time (ride request, credits top-up), not at tokenization, so a declining card can be saved and then fails when used.

### Apple Pay / Google Pay (mock)
- Frontend shows a realistic bottom-sheet confirmation (Apple Pay style with a ~1.2s "confirming" animation, Google Pay style with an account row). No official Apple or Google logo artwork; use clean text-based buttons.
- On confirm, frontend calls `/mockpay/v1/wallet-tokens`, which returns a device token with brand VISA and a random device last4 that behaves as a success card.
- Show Apple Pay only on iOS user agents and Google Pay only on Android, unless `NEXT_PUBLIC_DEMO_SHOW_ALL_WALLETS=true` (default true for the demo).

### Driver earnings
- Each completed ride adds a `RIDE_EARNING` entry for `driverPayout`. Balance is the sum of all entries.
- **Cash out**: instant payout of the whole balance to a saved card via `PaymentGateway.payout`, writes a `PAYOUT` entry for `-balance`, balance becomes 0.
- `today` and `week` are sums of RIDE_EARNING entries for the current calendar day and ISO week in `America/New_York`.

---

## 6. Database (Postgres 16, Flyway)

Owner in brackets. Owners write their own tables; anyone may read any table. Enum columns are `varchar` holding the enum name. Money is `numeric`. Timestamps are `timestamptz`.

- `users` [Hriday]: id uuid pk, email unique, name, phone, mode, rating_avg numeric(3,2) default 5.00, rating_count int default 0, created_at
- `driver_profiles` [Hriday writes onboarding fields, Dev writes is_online/location fields]: user_id pk fk users, license_number, car_make, car_model, car_color, plate, status, is_online bool default false, current_lat, current_lng, last_seen_at
- `hubs` [Hriday]: id uuid pk, code unique, name, zone, lat, lng
- `fares` [Hriday]: from_zone, to_zone, price numeric(5,2), pk(from_zone, to_zone), both directions stored
- `mockpay_vault` [Hriday, mockpay]: token pk (`tok_...`), brand, last4, exp_month, exp_year, wallet_type nullable, behavior (`SUCCESS` or a DeclineCode), created_at. Never a full card number or CVC.
- `mockpay_charges` [Hriday, mockpay]: id pk (`pi_...`), token, amount, status, idempotency_key unique, created_at, updated_at. Status values are mockpay-internal.
- `payment_methods` [Hriday]: id uuid pk, user_id, type, brand, last4, exp_month, exp_year, nickname, is_default bool, gateway_token, created_at, deleted_at nullable (soft delete). Exactly one non-deleted default per user (enforced in code).
- `ride_payments` [Hriday]: id uuid pk, ride_id unique, user_id, payment_method_id nullable, amount_total, credits_applied, card_amount, status, gateway_ref nullable, decline_code nullable, authorized_at, captured_at, voided_at
- `credit_transactions` [Hriday]: id uuid pk, user_id, ride_id nullable, type, amount numeric(8,2) (positive adds, negative spends), created_at. Balance is the sum.
- `driver_earnings` [Hriday]: id uuid pk, driver_id, ride_id nullable, type, amount numeric(8,2), payment_method_id nullable (for payouts), created_at
- `rides` [Dev]: id uuid pk, rider_id, driver_id nullable, pickup_hub_id, dropoff_hub_id, status, fare_total, platform_fee, base_fare, driver_payout, platform_margin, pin char(4), share_token unique, promo_code nullable, cancel_reason, cancelled_by, scheduled_for nullable, requested_at, accepted_at, arrived_at, started_at, completed_at, cancelled_at
- `ride_offers` [Dev]: id uuid pk, ride_id, driver_id, status, offered_at, expires_at, responded_at
- `ratings` [Hriday]: id uuid pk, ride_id, rater_id, ratee_id, stars 1 to 5, comment, created_at, unique(ride_id, rater_id)
- `chat_messages` [Dev, stretch]: id uuid pk, ride_id, sender_id, body, created_at
- `promo_codes` [Hriday, stretch]: code pk, discount numeric(5,2), active bool

Foreign keys from `ride_payments`, `credit_transactions`, and `driver_earnings` to `rides` are `DEFERRABLE INITIALLY DEFERRED`, so `authorizeRide` can insert payment rows in the same transaction before the ride row is flushed.

Migrations: `V1__baseline_schema.sql` and `V2__seed_data.sql` are frozen once merged. New migrations use timestamp versions so parallel branches never collide: `V20261011_1430__short_description.sql`.

---

## 7. Seed data (V2) and fixed UUIDs

### Users

| Who | Email | Name | UUID |
|---|---|---|---|
| rider1 | rider1@scarletmail.rutgers.edu | Jordan Patel | `00000000-0000-0000-0000-000000000101` |
| rider2 | rider2@scarletmail.rutgers.edu | Sam Rivera | `00000000-0000-0000-0000-000000000102` |
| driver1 | driver1@scarletmail.rutgers.edu | Alex Kim | `00000000-0000-0000-0000-000000000201` |
| driver2 | driver2@scarletmail.rutgers.edu | Maya Johnson | `00000000-0000-0000-0000-000000000202` |
| driver3 | driver3@scarletmail.rutgers.edu | Chris Nguyen | `00000000-0000-0000-0000-000000000203` |
| driver4 | driver4@scarletmail.rutgers.edu | Priya Shah | `00000000-0000-0000-0000-000000000204` |
| driver5 | driver5@scarletmail.rutgers.edu | Marcus Lee | `00000000-0000-0000-0000-000000000205` |

### Hubs

| Code | Name | Zone | Lat | Lng | UUID |
|---|---|---|---|---|---|
| YARD | The Yard | COLLEGE_AVE | 40.4998 | -74.4479 | `00000000-0000-0000-0000-000000000301` |
| BUSCH_SC | Busch Student Center | BUSCH | 40.5232 | -74.4585 | `00000000-0000-0000-0000-000000000302` |
| LIVI_SC | Livingston Student Center | LIVINGSTON | 40.5240 | -74.4366 | `00000000-0000-0000-0000-000000000303` |
| COOK_CC | Cook Campus Center | COOK_DOUGLASS | 40.4797 | -74.4362 | `00000000-0000-0000-0000-000000000304` |
| DOUGLASS_SC | Douglass Student Center | COOK_DOUGLASS | 40.4853 | -74.4371 | `00000000-0000-0000-0000-000000000305` |
| NB_STATION | New Brunswick Station | DOWNTOWN | 40.4966 | -74.4455 | `00000000-0000-0000-0000-000000000306` |

### Drivers (all APPROVED, online, mode DRIVER)

| Driver | Car | Plate | Parked near | Lat, Lng |
|---|---|---|---|---|
| driver1 | Blue Honda Civic | R23-HKP | The Yard | 40.5004, -74.4471 |
| driver2 | Silver Toyota Camry | S81-MTW | Busch Student Center | 40.5226, -74.4577 |
| driver3 | White Hyundai Elantra | K56-BNX | Livingston Student Center | 40.5233, -74.4378 |
| driver4 | Gray Toyota Prius | T09-LRV | Cook Campus Center | 40.4804, -74.4351 |
| driver5 | Black Honda Accord | M74-GDC | New Brunswick Station | 40.4972, -74.4463 |

### Payment methods (with matching `mockpay_vault` rows)

| UUID | Owner | Label | Type | Default | Vault token | Behavior |
|---|---|---|---|---|---|---|
| `00000000-0000-0000-0000-000000000401` | rider1 | Visa •••• 4242 (exp 12/2030) | CARD | yes | `tok_seed_rider1_visa` | SUCCESS |
| `00000000-0000-0000-0000-000000000402` | rider1 | Apple Pay (Visa •••• 8431) | APPLE_PAY | no | `tok_seed_rider1_applepay` | SUCCESS |
| `00000000-0000-0000-0000-000000000403` | rider2 | Mastercard •••• 4444 (exp 09/2029) | CARD | yes | `tok_seed_rider2_mc` | SUCCESS |
| `00000000-0000-0000-0000-000000000404` | rider2 | Visa •••• 0002 "Old card" (exp 06/2028) | CARD | no | `tok_seed_rider2_oldcard` | CARD_DECLINED |
| `00000000-0000-0000-0000-000000000411` … `415` | driver1 … driver5 | Visa •••• 5556 "Debit card" (exp 03/2030) | CARD | yes | `tok_seed_driver1_debit` … `tok_seed_driver5_debit` | SUCCESS |

### Credits
- rider1: one `PROMO` credit transaction of +5.00, UUID `00000000-0000-0000-0000-000000000501`.

### Fares
All 25 rows of the table in section 4 (both directions).

---

## 8. REST endpoints

### Health
- `GET /api/health` → `{"status":"ok"}` (public)

### Auth and users [Hriday]
- `POST /api/auth/request-otp` `{email}` → `{devOtp}`. Only `@scarletmail.rutgers.edu`, else 400 `INVALID_EMAIL_DOMAIN`. OTP is 6 digits, valid 10 minutes, returned in the response for the demo.
- `POST /api/auth/verify-otp` `{email, otp, name?}` → `{token, user: User}`. Creates the user (mode RIDER) on first login. Wrong OTP: 400 `INVALID_OTP`.
- `GET /api/users/me` → `User`
- `PATCH /api/users/me` `{name?, phone?, mode?}` → `User`. Switching to DRIVER without an APPROVED profile returns 409 `DRIVER_NOT_ONBOARDED`.

### Drivers [Hriday]
- `POST /api/drivers/onboard` `{licenseNumber, carMake, carModel, carColor, plate}` → `DriverProfile` (auto APPROVED)
- `GET /api/drivers/me` → `DriverProfile` (404 `NOT_FOUND` if not onboarded)

### Hubs and pricing [Hriday]
- `GET /api/hubs` → `Hub[]` (public)
- `GET /api/fares/quote?from={hubId}&to={hubId}` → `FareBreakdown`

### Mock processor [Hriday, public, simulated external service]
- `POST /mockpay/v1/tokens` `{number, expMonth, expYear, cvc}` → `CardToken` or 400 `INVALID_NUMBER` / `INVALID_EXPIRY` / `INVALID_CVC`. `number` may contain spaces.
- `POST /mockpay/v1/wallet-tokens` `{walletType: "APPLE_PAY" | "GOOGLE_PAY"}` → `CardToken` (with `walletType` set)

### Payment methods and credits [Hriday]
- `GET /api/payment-methods` → `PaymentMethod[]` (default first, then newest)
- `POST /api/payment-methods` `{token, nickname?}` → `PaymentMethod`. Type comes from the vault (`walletType` or CARD). First method becomes default. Same brand+last4+expiry already saved: 409 `DUPLICATE_PAYMENT_METHOD`.
- `PATCH /api/payment-methods/{id}` `{isDefault?, nickname?}` → `PaymentMethod`
- `DELETE /api/payment-methods/{id}` → 204. 409 `PAYMENT_METHOD_IN_USE` if it holds an active authorization. Deleting the default promotes the newest remaining method.
- `GET /api/credits` → `Credits`
- `POST /api/credits/topup` `{amount: 10 | 20 | 50, paymentMethodId}` → `Credits` (charged immediately through the gateway; declines return 402 `PAYMENT_DECLINED`)
- `POST /api/credits/redeem` `{code}` → `Credits` (stretch)

### Driver earnings [Hriday]
- `GET /api/me/earnings` → `Earnings`
- `POST /api/me/earnings/cashout` `{paymentMethodId}` → `CashoutResult`

### Driver availability [Dev]
- `POST /api/drivers/me/online` `{lat, lng}` → `DriverProfile` (409 `DRIVER_NOT_ONBOARDED` if not APPROVED)
- `POST /api/drivers/me/offline` → `DriverProfile`
- `POST /api/drivers/me/location` `{lat, lng}` → 204
- `GET /api/drivers/me/offer` → `RideOffer` (the caller's live OFFERED offer) or 204. Lets the driver app recover after a WebSocket reconnect.

### Rides [Dev]
- `POST /api/rides` `{pickupHubId, dropoffHubId, paymentMethodId?, useCredits?, promoCode?, scheduledFor?}` → `Ride` (201). Quotes the fare with `FareService`, inserts the ride, calls `authorizeRide` in the same transaction. 402 `PAYMENT_DECLINED` (with `declineCode`) or 402 `PAYMENT_METHOD_REQUIRED` means no ride is created. 409 `ACTIVE_RIDE_EXISTS` if the rider already has an active ride. Starts matching after commit.
- `GET /api/rides/{id}` → `Ride` (rider or assigned driver only, else 403)
- `GET /api/rides/active` → `Ride` or 204. The caller's active ride as rider or as driver.
- `POST /api/rides/{id}/accept` (driver holding the live offer) → `Ride`. 409 `OFFER_NOT_ACTIVE` if the offer expired.
- `POST /api/rides/{id}/decline` (driver holding the live offer) → 204
- `POST /api/rides/{id}/arrived` (assigned driver) → `Ride`
- `POST /api/rides/{id}/start` `{pin}` (assigned driver; wrong PIN 400 `INVALID_PIN`) → `Ride`
- `POST /api/rides/{id}/complete` (assigned driver; calls `captureRide`) → `Ride`
- `POST /api/rides/{id}/cancel` `{reason}` (rider or assigned driver; calls `voidRide`) → `Ride`. NO_DRIVERS also calls `voidRide`.
- `GET /api/share/{shareToken}` public, stretch → `PublicRideView`
- `GET /api/rides/{id}/chat` → `ChatMessage[]`, `POST /api/rides/{id}/chat` `{body}` → `ChatMessage` (stretch)

### Records [Hriday]
- `POST /api/rides/{id}/rating` `{stars, comment?}` → 204. Rider rates driver or driver rates rider (ratee is inferred). Ride must be COMPLETED. Updates ratee `rating_avg` / `rating_count`. 409 `ALREADY_RATED`.
- `GET /api/me/rides?mode=RIDER|DRIVER` → `RideSummary[]`, newest first
- `GET /api/rides/{id}/receipt` → `Receipt` (COMPLETED rides only)
- `GET /api/admin/stats` stretch → `AdminStats`

### Claude assistant [Hriday backend, Tanay frontend; stretch]
- `POST /api/assistant/commands` `{message}` → `AssistantCommand`. Authenticated. `message` is trimmed, must contain 1-500 characters, and may come from speech transcription or typed input.
- The backend sends Claude only the message, the caller's current `UserMode`, and the current hub ids/codes/names. Claude returns one bounded action; the backend treats that output as untrusted, validates the action against the caller's mode, and validates every hub id against the current hub catalog.
- In RIDER mode, an unambiguous request to travel between two different hubs returns `BOOK_RIDE` with both hub ids. In DRIVER mode, an unambiguous request to find rides ending at a hub returns `WATCH_RIDES` with only `dropoffHubId`. A request to stop a driver watch returns `STOP_WATCHING`. Unsupported, mode-incompatible, or ambiguous requests return `HELP` with a clarification in `reply`; all hub fields are null and no state changes.
- Missing configuration, provider errors/timeouts, or malformed provider output return 503 `ASSISTANT_UNAVAILABLE`. No action is executed on an error.

### Voice (ElevenLabs) [Dev backend, Tanay frontend; stretch]
- `POST /api/voice/transcribe` `multipart/form-data` with one part `audio` (webm, ogg, mp4/m4a, mpeg or wav; at most 1 MB and 15 seconds) → `VoiceTranscript`. Authenticated. The spoken language is detected automatically; `text` is in that language (no translation) and is `""` when no speech was found. Larger or unsupported audio: 400 `VALIDATION_ERROR`.
- `POST /api/voice/speech` `{text, languageCode?}` → `200` with an `audio/mpeg` body. Authenticated. `text` is trimmed and must contain 1-300 characters (400 `VALIDATION_ERROR` otherwise); `languageCode` (ISO 639-1, e.g. `"es"`) is a hint for pronunciation. Identical `text` + `languageCode` is served from a server-side cache, so repeated phrases spend provider credits once.
- Missing configuration, provider errors/timeouts, exhausted credits, or malformed provider output return 503 `VOICE_UNAVAILABLE`. Callers must treat voice as optional and fall back to text.

---

## 9. DTOs

All fields are required unless marked `?` (nullable, still present as `null`).

- `User`: id, email, name, phone?, mode `UserMode`, ratingAvg, ratingCount, isDriverApproved
- `DriverProfile`: userId, licenseNumber, carMake, carModel, carColor, plate, status `DriverStatus`, isOnline, lat?, lng?
- `Hub`: id, code, name, zone `Zone`, lat, lng
- `FareBreakdown`: total, platformFee, baseFare, driverPayout, platformMargin
- `DriverCard`: id, name, ratingAvg, carMake, carModel, carColor, plate, lat?, lng?
- `RideParticipant`: id, name, ratingAvg
- `Ride`: id, status `RideStatus`, payment `PaymentSummary`, rider `RideParticipant`, driver `DriverCard`?, pickupHub `Hub`, dropoffHub `Hub`, fare `FareBreakdown`, pin? (only returned to the rider, null for the driver), shareToken, requestedAt, acceptedAt?, arrivedAt?, startedAt?, completedAt?, cancelledAt?, cancelReason?, cancelledBy? (`"RIDER" | "DRIVER" | "SYSTEM"`)
- `RideSummary`: id, status, pickupHubName, dropoffHubName, total, driverPayout, completedAt?, requestedAt
- `Receipt`: rideId, pickupHubName, dropoffHubName, fare `FareBreakdown`, payment `PaymentSummary`, driverName, riderName, startedAt?, completedAt?, durationSeconds?
- `RideOffer`: offerId, rideId, pickupHub `Hub`, dropoffHub `Hub`, fare `FareBreakdown`, riderName, riderRating, distanceToPickupMeters, expiresAt
- `PaymentMethod`: id, type `PaymentMethodType`, brand `CardBrand`, last4, expMonth, expYear, nickname?, isDefault, label
- `PaymentSummary`: status `PaymentStatus`, methodLabel, creditsApplied, cardAmount, amountTotal, declineCode? `DeclineCode`
- `CreditTransaction`: id, type `CreditTxnType`, amount, rideId?, createdAt
- `Credits`: balance, transactions `CreditTransaction[]` (newest first)
- `Earnings`: balance, today, week, total, rides `RideSummary[]`
- `CashoutResult`: balance, payoutAmount, methodLabel
- `CardToken`: token, brand `CardBrand`, last4, expMonth, expYear, walletType? (`"APPLE_PAY" | "GOOGLE_PAY"`)
- `AuthResponse`: token, user `User`
- `OtpResponse`: devOtp
- `PublicRideView` (stretch): status, pickupHub `Hub`, dropoffHub `Hub`, driver `DriverCard`?, riderFirstName, etaSeconds?, updatedAt
- `ChatMessage` (stretch): id, senderId, body, createdAt
- `AdminStats` (stretch): ridesToday, activeRides, driversOnline, grossToday, marginToday
- `AssistantCommand` (stretch): action `AssistantAction`, reply, pickupHubId?, dropoffHubId?
- `VoiceTranscript` (stretch): text, languageCode? (ISO 639-1, null when no speech was found)
- `ApiError`: error, message, declineCode? (only on 402 `PAYMENT_DECLINED`)

---

## 10. Matching rules [Dev]

- Candidates: APPROVED, online drivers with no active ride and no live offer, sorted by haversine distance from their current location to the pickup hub.
- Offer to the nearest for 15 seconds (`ride_offers` row OFFERED, `expires_at = offered_at + 15s`). On decline or expiry, offer to the next. No candidates left: NO_DRIVERS (calls `voidRide`, `cancelledBy = "SYSTEM"`).
- One live offer per driver at a time. A driver who declined or let an offer expire is not re-offered the same ride.
- If the rider cancels while an offer is live, the offer becomes EXPIRED and `{type: "OFFER_REVOKED", offerId}` is sent to the driver.
- On accept, generate a 4-digit PIN (returned to the rider only) and set ACCEPTED.

---

## 11. WebSocket (STOMP)

- Endpoint `/ws` (plain WebSocket, no SockJS). JWT in the `Authorization: Bearer <jwt>` header of the STOMP CONNECT frame. When `app.auth.demo-header=true`, an `X-Demo-User` CONNECT header is also accepted.
- Clients only subscribe; they never send.

| Topic | Payload | When |
|---|---|---|
| `/topic/drivers/{driverId}/offers` | `RideOffer` or `{type: "OFFER_REVOKED", offerId}` | New offer for this driver; offer revoked |
| `/topic/rides/{rideId}/status` | `RideStatusEvent` `{rideId, status, driver: DriverCard \| null, etaSeconds: number \| null, updatedAt}` | Every status change |
| `/topic/rides/{rideId}/location` | `RideLocationEvent` `{lat, lng, heading, etaSeconds}` | About every 2 seconds while ACCEPTED or IN_PROGRESS |
| `/topic/rides/{rideId}/chat` | `ChatMessage` | Stretch |

`heading` is degrees 0-360 clockwise from north. `etaSeconds` is to pickup while ACCEPTED and to dropoff while IN_PROGRESS.

---

## 12. Simulator [Dev]

- Seeded drivers that are not logged in as real users auto-accept after 3 seconds, drive to pickup, mark ARRIVED, auto-start with the PIN, drive to dropoff, and complete (which captures payment), publishing location throughout. Real drivers are never auto-driven.
- Toggle with `app.simulator.enabled`.

---

## 13. Golden path (what `scripts/smoke.sh` must verify)

1. rider1 logs in (OTP flow).
2. Tokenize 5555 5555 5555 4444 at `/mockpay/v1/tokens` and save it.
3. Quote a fare.
4. Request a ride with `useCredits=true`: credits applied, remainder authorized.
5. Simulated driver accepts, arrives, starts with PIN, completes.
6. Payment is CAPTURED, driver earnings increased by `driverPayout`, receipt shows the method label, rating submitted.
7. Request with the 0002 card returns 402 `PAYMENT_DECLINED` with `declineCode` `CARD_DECLINED` and creates no ride.
8. Request then cancel leaves payment VOIDED and credits restored.

---

## 14. Claude assistant behavior (stretch)

- The authenticated rider and driver landing/home surfaces expose one Claude button. Pressing it once opens the assistant and starts listening (section 15). A typed-input fallback is always available. Only the transcript or typed message is sent to `/api/assistant/commands`; recorded audio goes only to `POST /api/voice/transcribe` (section 15).
- `BOOK_RIDE` is executed immediately without another confirmation by calling the existing `POST /api/rides` endpoint with the returned hub ids, `paymentMethodId = null`, `useCredits = true`, and null promo/schedule fields. The normal ride API remains authoritative for fare calculation, payment, active-ride checks, matching, and errors. On success the UI opens the active ride.
- `WATCH_RIDES` immediately places the driver online through the existing availability endpoint if needed, using the browser's current geolocation. If location permission is unavailable or denied, the UI explains that the watch could not start and performs no offer action.
- While a destination watch is active, the frontend consumes the existing driver offer WebSocket topic and `GET /api/drivers/me/offer` reconnect fallback. It declines live offers whose `dropoffHub.id` differs from the watched hub and accepts the first matching offer through the existing ride endpoints, without another confirmation. `OFFER_NOT_ACTIVE` is treated as a race and the watch continues; any other accept/decline error is shown to the driver.
- A destination watch is scoped to the signed-in browser session and stored only in session storage so it survives a reload/reconnect. It stops after a matching offer is accepted, on `STOP_WATCHING`, logout, switching out of DRIVER mode, or the browser session ending.
- The assistant never receives or gains direct access to JWTs, card/payment data, precise driver location, user profile data, databases, arbitrary URLs, or arbitrary application tools. It cannot create or accept a ride directly; it only returns `AssistantCommand`, and the existing endpoints enforce authorization and business rules.
- Assistant messages and transcripts are not persisted and are excluded from application logs. The Anthropic API key is backend-only, supplied as `ANTHROPIC_API_KEY`, and never committed or exposed through `NEXT_PUBLIC_*`. The model is configurable with `ANTHROPIC_MODEL`.

## 15. Voice: multilingual assistant and driver announcements (stretch)

ElevenLabs (hackathon sponsor) provides speech-to-text and text-to-speech through the two `/api/voice` endpoints in section 8. Voice is always optional: on 503 `VOICE_UNAVAILABLE`, or when the browser cannot record, the UI falls back to browser speech recognition (using the device language, not a fixed `en-US`) and to on-screen text.

**Multilingual assistant (voice in, voice out)**
- The Claude button records up to 15 seconds of audio in the browser and sends it to `POST /api/voice/transcribe`. The returned `text`, in the speaker's own language, is sent unchanged to `POST /api/assistant/commands`; Claude understands and replies in that language. An empty `text` shows "I couldn't hear that" and sends nothing.
- The assistant's `reply` is spoken with `POST /api/voice/speech`, passing the transcript's `languageCode`, and is also shown as text.

**Driver announcements**
- On the driver screens the app speaks short fixed phrases through `POST /api/voice/speech`: a new offer ("New trip to {dropoff hub name}. You earn {driverPayout}."), an `OFFER_REVOKED` ("The rider cancelled."), and completion ("Trip complete. You earned {driverPayout}.").
- Phrases contain only hub names and amounts, never a PIN or a rider's name, so they stay few and cacheable. A sound on/off toggle on the driver home is stored per device (local storage) and defaults to on.

**Privacy and cost**
- Audio is sent only from the browser to the UniHop backend and from there to ElevenLabs. It is never stored or logged; transcripts are not persisted and are excluded from application logs (as in section 14).
- The ElevenLabs key is backend-only, supplied as `ELEVENLABS_API_KEY`, and never committed or exposed through `NEXT_PUBLIC_*`. Voice, speech-to-text model and text-to-speech model are configurable with `ELEVENLABS_VOICE_ID`, `ELEVENLABS_STT_MODEL` and `ELEVENLABS_TTS_MODEL`.
- Credit guardrails (free tier): 15-second recordings, 300-character speech, and the server-side speech cache.
