# UniHop

Rutgers-only peer-to-peer campus rideshare. Uber for campus, every ride under $10.

- **Contract (source of truth):** [docs/contract.md](docs/contract.md)
- **Agent rules:** [CLAUDE.md](CLAUDE.md) (identical copy in [AGENTS.md](AGENTS.md) for Codex)
- **First prompt for your agent:** [docs/kickoff.md](docs/kickoff.md)

## Setup

1. Install **Docker Desktop** and **Git**.
2. Install Java 21 and Node 22:
   - **Mac:** install [mise](https://mise.jdx.dev), then run `mise install` in the repo (reads `.mise.toml`).
   - **Windows:** `winget install EclipseAdoptium.Temurin.21.JDK` and `winget install OpenJS.NodeJS --version 22`, then restart your terminal. **Use Git Bash for every command below.**
   - Check: `java -version` shows 21, `node -v` shows v22.
3. Clone and configure:
   ```bash
   gh repo clone TanayDesai-1510/unihop && cd unihop
   cp .env.example .env
   cp frontend/.env.example frontend/.env.local
   (cd frontend && npm ci)
   ```
4. Run everything (Postgres in Docker, backend on :8080, frontend on :3000):
   ```bash
   ./start.sh
   ```
5. Open the repo in the Claude Code app (or Codex) and paste your prompt from [docs/kickoff.md](docs/kickoff.md).

| What | URL |
|---|---|
| App | http://localhost:3000 |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| Health | http://localhost:8080/api/health |

Useful commands: `cd backend && ./mvnw test` (no Docker needed), `cd frontend && npm run build`, reset the DB with `docker compose -f .devcontainer/docker-compose.yml down -v`.

The frontend runs against built-in mocks while `NEXT_PUBLIC_USE_MOCKS=true` in `frontend/.env.local`. Set it to `false` to use the real backend.

## Demo logins

Log in with any of these emails. The OTP is shown on screen (`devOtp`); in mock mode it is always `123456`.

| Account | Email | UUID (for `X-Demo-User`) |
|---|---|---|
| rider1 (Visa 4242 default + Apple Pay, $5.00 UniHop Cash) | rider1@scarletmail.rutgers.edu | `00000000-0000-0000-0000-000000000101` |
| rider2 (Mastercard 4444 default + declining "Old card" 0002) | rider2@scarletmail.rutgers.edu | `00000000-0000-0000-0000-000000000102` |
| driver1 (Blue Honda Civic, near The Yard) | driver1@scarletmail.rutgers.edu | `00000000-0000-0000-0000-000000000201` |
| driver2 (Silver Toyota Camry, near Busch) | driver2@scarletmail.rutgers.edu | `00000000-0000-0000-0000-000000000202` |
| driver3 (White Hyundai Elantra, near Livingston) | driver3@scarletmail.rutgers.edu | `00000000-0000-0000-0000-000000000203` |
| driver4 (Gray Toyota Prius, near Cook) | driver4@scarletmail.rutgers.edu | `00000000-0000-0000-0000-000000000204` |
| driver5 (Black Honda Accord, near NB Station) | driver5@scarletmail.rutgers.edu | `00000000-0000-0000-0000-000000000205` |

Backend testing without a JWT (while `app.auth.demo-header=true`):

```bash
curl -H "X-Demo-User: 00000000-0000-0000-0000-000000000101" http://localhost:8080/api/users/me
```

Hub, payment-method, and credit UUIDs are in [contract section 7](docs/contract.md#7-seed-data-v2-and-fixed-uuids).

## Test cards

Any future expiry works. CVC is 3 digits (4 for Amex). Declines happen when the card is used, not when it's saved.

| Number | Brand | Behavior |
|---|---|---|
| 4242 4242 4242 4242 | Visa | Success |
| 5555 5555 5555 4444 | Mastercard | Success |
| 3782 822463 10005 | Amex | Success (4-digit CVC) |
| 6011 1111 1111 1117 | Discover | Success |
| 4000 0000 0000 0002 | Visa | Declined: `CARD_DECLINED` |
| 4000 0000 0000 9995 | Visa | Declined: `INSUFFICIENT_FUNDS` |
| 4000 0000 0000 0069 | Visa | Declined: `EXPIRED_CARD` |
| 4000 0000 0000 0127 | Visa | Declined: `INCORRECT_CVC` |

Any other Luhn-valid number succeeds. A bad Luhn number, past expiry, or wrong CVC length is rejected when tokenizing (`INVALID_NUMBER`, `INVALID_EXPIRY`, `INVALID_CVC`).

## Team

| Person | Owns |
|---|---|
| Tanay (TanayDesai-1510) | `frontend/`, integration, demo, frontend deploy |
| Hriday (hriday1136) | Backend platform: auth, user, driver, pricing, payments, mockpay, rating, records, admin |
| Dev (DAmin05) | Backend realtime: ride, matching, realtime, simulator, `scripts/smoke.sh`, backend deploy |
