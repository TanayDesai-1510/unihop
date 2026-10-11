# Frontend ↔ real backend: test checklist (issue #46)

Tanay built the frontend against mocks (Docker isn't available on his machine). This is the list for running it against the real backend and testing end to end on two phones.

The frontend calls only the endpoints and topics in `docs/contract.md`. If something doesn't match, **raise it with the team; don't patch around it** (#46 acceptance).

## 0. Merge order

PRs #82–#91 are independent except for two stacks:

- #83 → #84 (driver home, then driver in-ride)
- #86 → #91 (payment screen, then the pay-with sheet)

All of them merged together cleanly in a local check, and `tsc`, `lint`, `build`, and a mock end-to-end run pass on the combined tree.

## 1. Point the frontend at the backend

`frontend/.env.local` (never commit it):

```
NEXT_PUBLIC_USE_MOCKS=false
NEXT_PUBLIC_API_URL=http://<host>:8080
NEXT_PUBLIC_WS_URL=ws://<host>:8080/ws
NEXT_PUBLIC_MOCKPAY_URL=http://<host>:8080/mockpay/v1
NEXT_PUBLIC_DEMO_SHOW_ALL_WALLETS=true
```

- **Laptop only:** `<host>` = `localhost`.
- **Phones on the same Wi-Fi:** `<host>` = the laptop's LAN IP (e.g. `192.168.1.23`). `localhost` on a phone means the phone.
- `NEXT_PUBLIC_*` values are baked in at build time. After changing them, restart `npm run dev` or rebuild.

**Backend CORS:** `app.cors.origins` defaults to `http://localhost:3000` and also gates the WebSocket handshake. For phones, start the backend with:

```
CORS_ORIGINS=http://localhost:3000,http://<LAN-IP>:3000
```

## 2. Run the frontend for phones

Use a production build. It's faster on phones, and `next dev` blocks dev assets for non-localhost origins unless `allowedDevOrigins` is set.

```
cd frontend
npm run build
npx next start -H 0.0.0.0 -p 3000
```

Phones open `http://<LAN-IP>:3000`.

**Note:** over plain `http` on a LAN IP, browsers block geolocation (it needs a secure context). The driver screen detects this and switches to **Demo GPS** after about 5 seconds: it drives the real route and still posts `POST /api/drivers/me/location`. A "Demo GPS" chip shows when this is active. That's expected for the LAN test; on Vercel (https) real GPS is used.

## 3. Laptop pass: every screen with mocks off

Log in with OTP: the backend returns `devOtp`, and the login screen shows it as "Demo code".

| Screen | Account | Check |
|---|---|---|
| `/login` | rider1 | OTP request/verify; `INVALID_EMAIL_DOMAIN` and `INVALID_OTP` show inline |
| `/rider` | rider1 | Hubs load, quote shows, **Change** opens the Pay with sheet, UniHop Cash toggle |
| Request → ride | rider1 | Searching → driver card + PIN → live car on map → arrived → done |
| Decline | rider2, card `•••• 0002` | 402 `PAYMENT_DECLINED` / `CARD_DECLINED`; no ride is created |
| Cancel | rider1 | Cancel while searching; credits restored (check `/payment` activity) |
| `/receipt/{id}` | rider1 | You paid, credits applied, card charged, method label, rating |
| `/history` | rider1 | Trip listed under Today; tap → receipt |
| `/payment` | rider1 | Add funds, make default, nickname, remove (in-use → `PAYMENT_METHOD_IN_USE`), Apple/Google Pay |
| `/payment/add` | rider1 | `4242…` saves; `4000 0000 0000 0002` declines on first use; raw PAN only goes to `/mockpay/v1/tokens` (check the Network tab) |
| `/profile` | rider1 | Edit name/phone persists; Sign out clears token and closes the WS |
| `/driver/onboard` | rider2 | Onboard → auto APPROVED → lands on `/driver` |
| `/driver` | driver1 | Online toggle, offer with 15s ring, decline/expire, `OFFER_REVOKED` |
| Driver ride | driver1 | Accept → I've arrived → PIN (`INVALID_PIN` shakes) → Complete → You earned |
| `/earnings` | driver1 | Balance/today/week/total match; Cash out → "on its way"; second cash out → `NOTHING_TO_CASH_OUT` |
| `/history` Drives | driver1 | Drive listed with `+driverPayout` |

Also check each screen once with the backend **stopped**. You should see the error state with Retry and the "Reconnecting" banner, never a blank screen.

## 4. Golden path on two phones (contract §13)

1. **Phone A** = driver1, **Phone B** = rider1.
2. **Make sure driver1 gets the offer.** The simulator auto-accepts with seeded drivers who aren't logged in, usually within 3s, so it can beat driver1. For this test, either:
   - start the backend with `APP_SIMULATOR_ENABLED=false`, or
   - request from the hub nearest driver1.
3. Phone A: Drive mode → go online.
4. Phone B: pick a destination → Confirm pickup → Request with UniHop Cash on.
5. Phone A: offer appears (ring + haptic) → Accept.
6. Phone B: sees the driver card, plate, PIN, and the car moving.
7. Phone A: I've arrived → enter the rider's PIN → Complete ride.
8. Phone B: done → receipt shows the method label → rate.
9. Phone A: You earned → `/earnings` shows the new balance → Cash out.

Turn the simulator back on afterwards; `scripts/smoke.sh` relies on it.

## 5. If something breaks

- **CORS error in the console:** add the origin to `CORS_ORIGINS`.
- **WS stuck on "Reconnecting":** check `NEXT_PUBLIC_WS_URL` (scheme `ws://`, path `/ws`) and that the origin is in `CORS_ORIGINS`.
- **401 loop to `/login`:** the JWT secret changed or the token is stale; sign in again.
- **Field name mismatch:** the frontend types in `src/lib/types.ts` mirror contract §10. The backend records were compared field by field and matched. If one differs now, open an issue tagged `contract`.

## 6. Vercel deploy (issue #47)

Tanay does the Vercel login and project setup; it needs his account.

- **Root directory:** `frontend`. Framework: Next.js. Build: `npm run build`.
- **Env vars (Production):**
  ```
  NEXT_PUBLIC_USE_MOCKS=false
  NEXT_PUBLIC_API_URL=https://<backend-host>
  NEXT_PUBLIC_WS_URL=wss://<backend-host>/ws
  NEXT_PUBLIC_MOCKPAY_URL=https://<backend-host>/mockpay/v1
  NEXT_PUBLIC_DEMO_SHOW_ALL_WALLETS=true
  ```
- **The backend must be reachable over HTTPS/WSS.** Browsers block an `https` page from calling `http://` or `ws://` (mixed content). A LAN IP won't work from the Vercel URL; it needs a hosted backend or a tunnel (e.g. `cloudflared tunnel --url http://localhost:8080`).
- **Backend env:** `CORS_ORIGINS=https://<project>.vercel.app` (add preview domains if needed) and `FRONTEND_URL=https://<project>.vercel.app`.
- **PWA:** open the Vercel URL. On iOS: Safari → Share → Add to Home Screen. On Android: Chrome → Install app. Then run §4 again on the installed apps.
