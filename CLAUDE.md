# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev          # Start dev server on port 3003
npm run build        # Production build
npm run start        # Start production server on port 3003
npm run lint         # ESLint
npm run prepare      # Patches next-ws for WebSocket support (runs automatically on install)
```

## Environment Variables

Required (not committed):
- `NEXT_PUBLIC_API_URL` — Backend REST API base URL
- `NEXT_PUBLIC_WSS_URL` — WebSocket server URL for live battle updates

## Architecture

Next.js 16 app (App Router) with React 19 and TypeScript strict mode. All pages are client-side rendered (`"use client"`). The app is a **competitive mining battle simulator** where two contenders compete in rounds to find the best proof-of-work shares.

### Key architectural decisions:
- **No local database** — the app consumes an external REST API (`src/app/api.ts`) and receives real-time updates via WebSocket
- **Server Actions** for mutations only (`lib/actions/createBattle.ts`) with server-side validation
- **WebSocket** via `next-ws` for live battle state (best share updates, round updates, hit results)
- **CSS Modules** + CSS custom properties for styling, with dark mode via `prefers-color-scheme`
- **French localization** — UI text, number formatting (`Intl.NumberFormat` with `fr-FR`), HTML lang attribute

### Directory layout:
- `models/` — TypeScript types (Battle, BattleStatus, Hit, WebSocketEvents)
- `lib/` — Utilities (NumberFormatter, UnitConverter) and server actions
- `src/app/api.ts` — API client (getBattleStatus, getBattleHits, getAllBattles, createBattle)
- `src/app/battle/[id]/` — Battle detail page with real-time WebSocket updates
- `src/app/create/` — Battle creation form using `useActionState`
- `src/app/components/` — Shared components
- `src/app/api/[battle_id]/status/ws/` — WebSocket route handler

### Path alias:
`@/*` maps to `./src/*` (configured in tsconfig.json).
