# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Free Fire Tournament platform (FF Arena).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS (dark cyberpunk theme)
- **Auth**: Session-based (express-session + Node crypto)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/             # Express API server
│   │   └── src/
│   │       ├── routes/         # auth, tournaments, registrations, leaderboard, players,
│   │       │                   # notifications, reports, admin, wallet, my-matches
│   │       ├── middlewares/    # requireAuth, requireAdmin
│   │       └── lib/            # auth.ts (hashPassword, verifyPassword), logger.ts
│   └── freefire-tournament/    # React + Vite frontend
│       └── src/
│           ├── pages/          # home, tournaments, tournament-detail, leaderboard,
│           │                   # profile, login, register, admin, notifications,
│           │                   # wallet, my-matches
│           ├── components/     # layout.tsx, ui/
│           └── hooks/          # use-auth.tsx
├── lib/
│   ├── api-spec/               # OpenAPI spec + Orval codegen config
│   ├── api-client-react/       # Generated React Query hooks + customFetch exported
│   ├── api-zod/                # Generated Zod schemas from OpenAPI
│   └── db/
│       └── src/schema/         # users, tournaments, registrations, leaderboard,
│                               # notifications, reports, transactions
├── scripts/                    # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Features

- **User Auth**: Register/login with Free Fire UID, IGN, WhatsApp number; ban check on login
- **Tournament Management**: Admin creates/edits tournaments (title, prize pool, entry fee, date, max slots, map, mode, status)
- **Tournament Status**: upcoming / ongoing / completed with live countdown timer
- **Registration & Payments**: Dynamic form for solo/duo/squad (team member UID+IGN collection), payment verification
- **Room Details**: Room ID/Password visible to verified players 15 minutes before match start; in "My Matches" and tournament detail
- **Leaderboard**: Kill-point system (12pts Booyah, 1pt/kill), auto-rank calculation
- **Player Profiles**: Matches played, total kills, earnings, global rank
- **Global Leaderboard**: Platform-wide player rankings
- **Notifications**: Live notification feed
- **Reports**: Report player button with admin review
- **Wallet System**: Deposit via UPI, withdraw to UPI (min ₹100, admin approval), full transaction history
- **My Matches**: Upcoming matches with room unlock countdown, match history with results and prizes
- **Default Tournament Banners**: Mode-specific Unsplash images (solo/duo/squad) as fallback when no bannerUrl set; `getDefaultBanner(gameMode)` in `lib/tournament-defaults.ts`
- **Admin Dashboard** (7 tabs):
  1. Verifications — Approve/reject pending payments
  2. Tournaments — Edit tournament details, post room details; Players button opens player inspection dialog
  3. Create — Create new tournaments (with image upload for banner)
  4. Players — Ban/unban users
  5. Financial — Deposit/withdrawal stats, approve/reject both deposit and withdrawal requests
  6. Results — Post-tournament results: select tournament, enter kills/placement/prize per player, auto-calculates points, updates global leaderboard
  7. Settings — UPI ID/name config + QR code image upload
- **Admin Player Inspection**: View all registrations per tournament; Kick player (disqualify + optional reason + entry fee refund)
- **Kick endpoint**: `POST /api/tournaments/:id/players/:regId/kick` — refunds entry fee if paid, decrements filledSlots
- **Wallet-based entry fee**: Registration for paid tournaments deducts from wallet instantly (auto-verified); insufficient balance returns 402 `INSUFFICIENT_BALANCE` code → frontend shows deposit dialog
- **Back button**: Tournament detail page has "Back to Tournaments" navigation button
- **Tournament results**: Completed tournaments show final results table with Booyah winner, kills, placement, prize won; admin posts via Results tab

## DB Schema

- `users`: id, username, email, passwordHash, freeFireUid, inGameName, whatsappNumber, isAdmin, **isBanned**, **walletBalance**, totalEarnings, globalRank, matchesPlayed
- `tournaments`: id, title, description, startDateTime, mapName, gameMode, maxSlots, filledSlots, status, prizePool, entryFee, bannerUrl, roomId, roomPassword
- `registrations`: id, tournamentId, userId, paymentStatus, paymentScreenshotUrl, transactionId, adminNote, **teamMembers** (jsonb)
- `transactions`: id, userId, type, amount, status, description, createdAt
- `leaderboard`, `notifications`, `reports`

## Default Credentials

- **Admin**: admin@ffarena.com / admin123
- **Player 1**: sniper@example.com / player123
- **Player 2**: ghost@example.com / player123

## Key Commands

- `pnpm --filter @workspace/api-server run dev` — API server dev
- `pnpm --filter @workspace/freefire-tournament run dev` — Frontend dev
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API hooks
- `pnpm --filter @workspace/db run push` — Push DB schema changes

## Design Notes

- Cyberpunk dark theme: neon green (#39FF14) + electric blue (#00F5FF), dark backgrounds (#0A0A0F)
- Session-based auth using Node.js `crypto` (scrypt) — no bcrypt/argon2 (avoids native binary issues)
- `customFetch` exported from `lib/api-client-react/src/index.ts` for custom API calls
- Windows compatibility: `start-windows.bat`, `shamefully-hoist=true` in `.npmrc`
