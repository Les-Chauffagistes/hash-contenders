# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev              # Start dev server on port 3003
npm run build             # Production build
npm run start              # Start production server on port 3003
npm run lint               # ESLint
npm test                   # Full test suite (unit + integration)
npm run test:unit          # Vitest, excludes *.integration.test.ts
npm run test:integration   # Vitest, integration tests (uses @testcontainers/postgresql for a real Postgres)
npm run prepare            # Patches next-ws for WebSocket support (runs automatically on install)
```

`docker-compose.yaml` runs the app (port 3003) alongside a local Postgres for development.

## Environment Variables

Required (not committed, see `.env`). Read server-side via `process.env` / `src/lib/config.ts` — **not** `NEXT_PUBLIC_`-prefixed, since the values that reach the browser are proxied through Server Actions and API routes:

- `API_URL`, `WSS_URL` — external battle "referee" service (REST + WebSocket)
- `BASE_URL` — this app's own base URL
- `AUTH_URL`, `AUTH_API_URL`, `JWT_SECRET` — authentication
- `COINS_API_URL`, `COINS_API_KEY` — wallet/coins service used for bet escrow and payouts
- `BETS_CURRENCY` — currency code used by the betting system
- `BITCOIN_API_URL`
- `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` — Cloudflare Turnstile captcha (gates coin claims / bet creation)
- `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT` — local Postgres backing the bets/escrow database (see `prisma/`)

## Architecture

Next.js 16 app (App Router) with React 19 and TypeScript strict mode. Most pages are client components (`"use client"`). The app is a **competitive mining battle simulator** where two contenders compete in rounds to find the best proof-of-work shares — with a **betting/escrow layer** on top where users wager coins on battle outcomes.

### Key architectural decisions:
- **Hybrid backend.** Battle data itself (battles, rounds, hits) is owned by an external Python "referee" service, consumed via REST (`src/clients/referee.ts`) and WebSocket — this app has no `Battle` table. Betting/escrow data (`Bet`, settlements, payouts) is owned locally in Postgres via Prisma (`prisma/schema.prisma`), because it needs real transactional guarantees the external service doesn't provide.
- **Transactional outbox for payouts.** Any write that must cross the network to the wallet service (`COINS_API_URL`) is first recorded in `payout_outbox` inside the same Postgres transaction as the business state change (bet created, settlement computed...). A background dispatcher replays pending rows with deterministic idempotency keys, so it never double-pays on retry.
- **Background loops started from `src/instrumentation.ts`**, once per server boot (Node runtime only): the payout dispatcher, a settlement "sweep" (safety net for battles the referee ended without a matching `battle_settlement`, in case the fast-path webhook is lost), and escrow reconciliation.
- **Server Actions** (`src/lib/actions/`) and **API routes** (`src/app/api/`) both perform mutations — Server Actions back form-driven UI flows (create battle, create bet, delete battle); API routes serve the bets/coins/internal-admin surface.
- **Auth** via JWT (`src/server/auth.ts`, `jose`) and **Turnstile captcha** (`src/server/captcha.ts`) gate bet creation and coin claims.
- **WebSocket** via `next-ws` for live battle state (best share updates, round updates, hit results).
- **CSS Modules** + CSS custom properties, fixed dark theme (`src/app/globals.css` — no `prefers-color-scheme` toggle).
- **OpenTelemetry** instrumentation via `@chauffagistes/cmn` (`src/instrumentation.ts`, `src/instrumentation.node.ts`).
- **French localization** — UI text, number formatting (`Intl.NumberFormat` with `fr-FR`), HTML lang attribute.

### Directory layout:
- `models/` — TypeScript types (Battle, BattleStatus, CreateBattle, Hit, User, WebSocketEvents)
- `prisma/` — Prisma schema + migrations for the local bets/escrow database; generated client output lives in `src/generated/prisma`
- `src/lib/` — utilities (NumberFormatter, RelativeTimeFormatter, UnitConverter, battleMode, config, errors, logger) and `actions/` (createBattle, createBet, deleteBattle)
- `src/server/` — server-only concerns: `auth.ts` (JWT), `captcha.ts` (Turnstile), `db.ts` (Prisma client), `env.ts`
- `src/clients/` — outbound HTTP clients: `referee.ts` (external battle service), `wallet.ts` (coins/escrow service), `auth.ts`
- `src/services/bets/` — per-bet-type creation and validation (betOnWinner, betOnBestShare)
- `src/services/settlement/` — settles or cancels a battle's bets once it ends, splits the pot proportionally
- `src/services/payouts/` — outbox dispatcher and idempotency key derivation for wallet-service calls
- `src/services/reconciliation/` — reconciles the local escrow ledger against the wallet service
- `src/app/api.ts` — battle API client (getBattleStatus, getBattleHits, getAllBattles, createBattle)
- `src/app/battle/[id]/` — battle detail page with real-time WebSocket updates, plus its own `bets/` sub-page
- `src/app/bets/` — bet browsing/creation UI (`create/forms/`: BetOnWinnerForm, BetOnBestShareForm)
- `src/app/my/` — current user's page (profile, coin balance/claim, gated by Turnstile)
- `src/app/create/` — battle creation form using `useActionState`
- `src/app/components/` — shared components
- `src/app/api/` — route handlers: `[battle_id]/status/ws` (WebSocket), `bets`, `bet`, `coins/{balance,claimable,claim}`, `internal/{reconciliation,battles/[battle_id]/{cancel,settle}}`

### Path alias:
`@/*` maps to `./src/*` (configured in tsconfig.json).
