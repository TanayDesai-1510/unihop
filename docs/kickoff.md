# Kickoff prompts

Paste your block as the first message of every new agent session (Claude Code desktop app, Claude Code cloud session, or Codex). It works the same in later sessions: the agent picks up the next open issue.

Before your first session:
1. `gh auth status` works and you have push access to the repo.
2. Clone, `cp .env.example .env`, and (Tanay) `cp frontend/.env.example frontend/.env.local`.
3. `java -version` shows 21 and `node -v` shows 22 (see README).

## Tanay

```
I'm Tanay. Read CLAUDE.md and docs/contract.md fully before doing anything.
I own /frontend only. Run `gh issue list --assignee @me --label mvp` and work
through my issues in number order against mocks (NEXT_PUBLIC_USE_MOCKS=true).
Follow every rule in CLAUDE.md. Stop and summarize after each PR.
```

## Hriday

```
I'm Hriday. Read CLAUDE.md and docs/contract.md fully before doing anything.
I own backend packages auth, user, driver, pricing, payments, mockpay, rating,
records, admin. Run `gh issue list --assignee @me --label mvp` and work in number order.
CurrentUser and JWT come first because Dev depends on them, then the mock
processor and real PaymentService. Follow every rule in CLAUDE.md. Stop and summarize after each PR.
```

## Dev

```
I'm Dev. Read CLAUDE.md and docs/contract.md fully before doing anything.
I own backend packages ride, matching, realtime, simulator, and scripts/smoke.sh.
Run `gh issue list --assignee @me --label mvp` and work in number order. Use the
FareService and PaymentService interfaces and the X-Demo-User header; never wait
on Hriday. Follow every rule in CLAUDE.md. Stop and summarize after each PR.
```

## Cloud sessions

Add this line to the prompt when starting a cloud session:

```
This is a cloud session: no Docker, no browser. Only run ./mvnw test and npm run build,
and mark the PR "Built in a cloud session, needs local verification before merge."
```
