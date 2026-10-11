# UniHop: agent instructions

> `CLAUDE.md` and `AGENTS.md` are identical copies (Claude Code reads the first, Codex the second). Edit both or neither.

## Project

UniHop is a Rutgers-only peer-to-peer campus rideshare app: "Uber for campus, every ride under $10." Riders pick a pickup and dropoff hub, see a fixed fare, pay with a saved card / Apple Pay / Google Pay / UniHop Cash, and get matched with a nearby student driver who drives them, entering the rider's PIN to start. It is being built in a **24-hour hackathon. Hard deadline: 10:00 AM. Submit by 9:30 AM.**

Three humans build in parallel, each with their own agent (Claude Code desktop app local sessions, Claude Code cloud sessions, or Codex).

**Stack**
- Backend: Java 21, Spring Boot 3.5, Maven wrapper, Postgres 16, Flyway, Spring Data JPA, Spring Security + JJWT, STOMP over WebSocket, springdoc (Swagger). Tests: JUnit 5 + zonky embedded Postgres (no Docker needed).
- Frontend: Next.js 16 (App Router, `src/`, Turbopack, Cache Components on), React 19, TypeScript, Tailwind 4, Leaflet / react-leaflet, @stomp/stompjs. Installable PWA, mobile-first.

**Layout**
```
backend/                 Spring Boot app (package com.unihop)
  src/main/resources/db/migration/   Flyway: V1 schema, V2 seed, then timestamped migrations
frontend/                Next.js app
  src/lib/types.ts       Contract DTOs and enums (shared)
  src/lib/api.ts         Typed REST client (shared)
  src/lib/ws.ts          Typed STOMP client (shared)
  src/lib/cards.ts       Luhn / brand / label helpers
  src/mocks/             In-memory mock backend + WS (NEXT_PUBLIC_USE_MOCKS=true)
docs/contract.md         SOURCE OF TRUTH: APIs, DB, WS events, cross-team interfaces, seed UUIDs
docs/kickoff.md          First-session prompt for each human's agent
scripts/smoke.sh         Golden-path end-to-end test (Dev builds it)
.devcontainer/           docker-compose for Postgres (+ optional VS Code dev container)
start.sh                 Starts Postgres, backend (:8080), frontend (:3000)
```

**Run it (local laptop)**
```bash
cp .env.example .env                      # once
cp frontend/.env.example frontend/.env.local   # once
cd frontend && npm ci && cd ..            # once
./start.sh                                # Postgres in Docker + backend + frontend
```
- Frontend http://localhost:3000, backend http://localhost:8080, Swagger http://localhost:8080/swagger-ui.html, health http://localhost:8080/api/health.
- Postgres only: `docker compose -f .devcontainer/docker-compose.yml up -d db`
- Backend only: `cd backend && ./mvnw spring-boot:run`. Frontend only: `cd frontend && npm run dev`.
- Reset the database: `docker compose -f .devcontainer/docker-compose.yml down -v` then start again (Flyway re-applies V1, V2, ...).

---

## Rule 1: The contract is law

Read `docs/contract.md` in full before doing any work in a session.

Never change the contract, a DTO, an enum, an endpoint, a WebSocket payload, an error code, or a cross-team interface signature on your own. If something seems wrong or missing, **stop and ask your human**. The human agrees the change with the team out loud, updates `docs/contract.md` first (in its own small PR), and only then does code change to match.

Java DTOs/enums and `frontend/src/lib/types.ts` must match the contract exactly: same names, same fields, same nullability.

## Rule 2: Stay in your lane

| Human | GitHub | Owns (only edit these) |
|---|---|---|
| Tanay | TanayDesai-1510 | `frontend/**` (all UI), integration, demo flow, frontend deploy |
| Hriday | hriday1136 | `backend/src/**/com/unihop/{auth,user,driver,pricing,payments,mockpay,rating,records,admin}/**` and their tests |
| Dev | DAmin05 | `backend/src/**/com/unihop/{ride,matching,realtime,simulator}/**` and their tests, `scripts/smoke.sh`, backend deploy |

- Only edit files owned by the human you are working with. Every backend package has a `package-info.java` naming its owner.
- **Shared files need your human's explicit OK before you touch them:** `backend/src/main/java/com/unihop/common/**`, `frontend/src/lib/types.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/ws.ts`, `docs/contract.md`, migrations `V1__baseline_schema.sql` and `V2__seed_data.sql`, `backend/pom.xml`, `application.yml`, and root config (`start.sh`, `.devcontainer/`, `.env.example`, `.gitattributes`, `.mise.toml`, `CLAUDE.md`, `AGENTS.md`, `README.md`).
- Working for Hriday or Dev: never edit `frontend/`.
- Working for Tanay: never edit `backend/` (read it as much as you like).
- Tables: owners write their own tables (contract section 6); anyone may read any table.

## Rule 3: Never wait on a teammate

If you need something another human owns, use the existing stub or mock and keep going.
- Backend: compile against the cross-team interfaces (`CurrentUser`, `FareService`, `PaymentService`, contract section 1). They work from the scaffold: `CurrentUser` reads the `X-Demo-User: <user uuid>` header, `FareService` is real, `PaymentService` is a stub that always authorizes. Seed UUIDs are in contract section 7.
- Frontend: build every screen against `src/mocks` (`NEXT_PUBLIC_USE_MOCKS=true`). Mock rules are at the top of `src/mocks/api.ts` (OTP is 123456, promo `NODRIVERS` forces NO_DRIVERS, driver-mode PIN is 1234, etc.).

## Rule 4: Small and frequent

- Work on **one GitHub issue at a time**, in number order among your human's issues: `gh issue list --assignee @me --label mvp --state open` (lowest number first).
- Before starting an issue: `git checkout main && git pull`, then branch `<name>/<feature>` (e.g. `dev/matching`, `hriday/otp-auth`, `tanay/login`).
- Finish, verify (Rule 5), commit, push, then `gh pr create --fill` with `Closes #N` in the body. Aim for a PR at least every 60 minutes.
- After each PR, **stop and summarize for your human** (what changed, how it was verified, anything left incomplete) before starting the next issue.
- Never force-push. Never commit directly to `main`. Never merge someone else's PR without your human's say-so.

## Rule 5: Done means verified

Done means it builds, it runs, relevant tests pass, and `scripts/smoke.sh` still passes once it exists.
- Backend: `cd backend && ./mvnw test` (works without Docker).
- Frontend: `cd frontend && npm run build` (also run `npm run lint`).
- No stubbed returns, fake data, or TODOs passed off as finished. If you leave something incomplete, say so explicitly in the PR and to your human.

## Rule 6: Don't spin

If the same error survives 3 fix attempts, stop and explain the problem to your human (what you tried, what you think is wrong) instead of trying more variations.

## Rule 7: Secrets and card data

- Never commit `.env`, `.env.local`, or any key or token.
- Raw card numbers and CVCs go **only** from the frontend to `POST /mockpay/v1/tokens`. Never send them to `/api/**`, never log them (frontend or backend), never store them. The vault stores token, brand, last4, expiry, wallet type, and behavior only.

## Rule 8: Know your environment

- Start every session by checking `java -version` (must be 21) and `node -v` (must be 22.x, ideally 22.13+). If either is wrong, install the right version before anything else: Mac `mise install`; Windows `winget install EclipseAdoptium.Temurin.21.JDK` / `winget install OpenJS.NodeJS --version 22`; cloud session: install directly.
- **Windows:** run shell commands and scripts (`./start.sh`, `./mvnw`, `scripts/smoke.sh`) in **Git Bash**, not PowerShell or cmd. Use forward slashes in paths inside scripts and config. Line endings are handled by `.gitattributes` (shell scripts and `mvnw` are LF); don't override it.
- **Local session:** Postgres via `./start.sh` or `docker compose -f .devcontainer/docker-compose.yml up -d db`, `DB_HOST=localhost`. You may run the full stack and test in a browser.
- **Cloud session** (no Docker, no browser, no phone): only run `./mvnw test` and `npm run build` / `npm run lint`. Never claim the UI, WebSockets, or the end-to-end flow were verified. Push the branch, open a PR with `Closes #N`, and put this line in the PR description: **"Built in a cloud session, needs local verification before merge."**
- **Project board** ("UniHop Hackathon"): before starting an issue, check it isn't already "In progress". If it is, pick your next one; never work on an issue someone else has in progress. Move yours to "In progress" and comment who is working on it (add "cloud session" if so), e.g. `gh issue comment N --body "Hriday's agent picking this up (cloud session)"`. PRs with `Closes #N` move it to Done when merged.

---

## Backend specifics

- Package `com.unihop.<area>`. Use `ApiException` (or its factories `badRequest`, `notFound`, `conflict`, `forbidden`, `unauthorized`) for every expected error so `GlobalExceptionHandler` renders `{"error": "CODE", "message": "..."}`. Only use error codes listed in contract section 2.
- Get the caller with `currentUser.id()`. Never parse JWTs or headers yourself outside `common`/`auth`.
- Money is `BigDecimal` with scale 2 (HALF_UP). Timestamps `Instant` / `timestamptz`, serialized as ISO-8601 UTC.
- Schema is owned by Flyway; Hibernate runs with `ddl-auto: validate`, so entity mappings must match the SQL exactly. **Never edit V1 or V2.** New migrations use timestamp versions so parallel branches never collide: `V20261011_1430__short_description.sql` (use the current date and time).
- Enums live in `com.unihop.common.enums`; map them with `@Enumerated(EnumType.STRING)`.
- Tests are required for: ride state transitions, matching (nearest driver, 15s timeout, re-dispatch, NO_DRIVERS), fare math, test-card tokenization behavior, and authorize/capture/void idempotency.
  - Pure logic gets plain JUnit tests.
  - Integration tests: `@SpringBootTest` + `@AutoConfigureEmbeddedDatabase(provider = ZONKY)` (see `BackendApplicationTests`). This boots real Postgres in-process, runs Flyway V1/V2, and needs no Docker, so it works in cloud sessions.
  - `src/test/resources/config/application.yml` supplies test-only properties (JWT secret, simulator off, mockpay latency 0).
- WebSocket: plain STOMP at `/ws` (no SockJS), topics exactly as in contract section 11. Clients never send.
- `app.*` properties (in `application.yml`): `app.jwt.secret`, `app.cors.origins`, `app.auth.demo-header`, `app.simulator.enabled`, `app.mockpay.latency-ms`, `app.frontend-url`.

## Frontend specifics

- Mobile-first: design at **375px** wide first, respect safe areas (`env(safe-area-inset-*)`, `viewport-fit=cover` is set). Must feel right as an installed PWA on a phone.
- All backend calls go through `api` from `@/lib/api`, and all realtime through `realtime` from `@/lib/ws`. Never call `fetch` for backend data directly in components. Catch `ApiRequestError` and branch on `.code` (and `.declineCode` for 402 PAYMENT_DECLINED).
- Keep `src/mocks` in sync with the contract. If a screen needs mock behavior that doesn't exist, add it to the mocks (they are Tanay's), but never add fields that aren't in the contract.
- Every screen handles **loading, empty, and error** states.
- Next.js 16 differs from older training data: check `frontend/node_modules/next/dist/docs/` before using an unfamiliar API (`frontend/AGENTS.md` is regenerated by `next dev`; keep it committed).
- **Next.js 16 Cache Components are on.** Client hooks that read request data (`useParams`, `useSearchParams`, `usePathname` on dynamic routes) must render inside `<Suspense>`. Pattern: `page.tsx` is a server component that returns `<Suspense fallback={...}><ClientScreen /></Suspense>`. See `src/app/rider/ride/[id]/page.tsx`. `npm run build` fails otherwise.
- Leaflet touches `window`: load map components with `next/dynamic` and `ssr: false`. Leaflet CSS is already imported in the root layout.
- No official Apple or Google logo artwork for the wallet sheets; use clean text-based buttons.
- To test on a phone on the same Wi-Fi: `npm run dev -- -H 0.0.0.0`, then open `http://<laptop-LAN-IP>:3000` (set `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WS_URL` to the LAN IP when using the real backend, and add that origin to `CORS_ORIGINS`).

---

## Timeline checkpoints (hours before the 10 AM deadline)

| When | Checkpoint |
|---|---|
| 22h before | Scaffold and contract done |
| 16h before | **Golden path works end to end on two phones** (stretch work waits until it does) |
| 8h to 5h before | Team sleeps in shifts |
| 2h before | **Feature freeze**: bug fixes and demo prep only |
| 9:30 AM | Submit |

Golden path (contract section 13): rider logs in, saves a card, quotes, requests with UniHop Cash, driver accepts, arrives, starts with PIN, completes, payment captured, driver earnings up, receipt shows the method, rating submitted. Plus: a declined card returns 402 and creates no ride; a cancelled ride voids the payment and restores credits.
