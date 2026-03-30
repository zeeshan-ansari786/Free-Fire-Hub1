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
│   │       ├── routes/         # auth, tournaments, registrations, leaderboard, players, notifications, reports, admin
│   │       ├── middlewares/    # requireAuth, requireAdmin
│   │       └── lib/            # auth.ts (hashPassword, verifyPassword), logger.ts
│   └── freefire-tournament/    # React + Vite frontend
│       └── src/
│           ├── pages/          # home, tournaments, tournament-detail, leaderboard, profile, login, register, admin, notifications
│           ├── components/     # layout.tsx, ui/
│           └── hooks/          # use-auth.tsx
├── lib/
│   ├── api-spec/               # OpenAPI spec + Orval codegen config
│   ├── api-client-react/       # Generated React Query hooks
│   ├── api-zod/                # Generated Zod schemas from OpenAPI
│   └── db/
│       └── src/schema/         # users, tournaments, registrations, leaderboard, notifications, reports
├── scripts/                    # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Features

- **User Auth**: Register/login with Free Fire UID, IGN, WhatsApp number
- **Tournament Management**: Admin creates tournaments (title, prize pool, entry fee, date, max slots, map, mode)
- **Tournament Status**: upcoming / ongoing / completed
- **Registration & Payments**: Join tournaments, upload payment screenshot, admin verifies
- **Room Details**: Room ID/Password only visible to verified registered players
- **Leaderboard**: Kill-point system (12pts Booyah, 1pt/kill), auto-rank calculation
- **Player Profiles**: Matches played, total kills, earnings, global rank
- **Global Leaderboard**: Platform-wide player rankings
- **Notifications**: Live notification feed
- **Reports**: Report player button with admin review
- **Admin Dashboard**: Stats, pending payments, create tournaments, post room details, manage leaderboard

## Default Credentials

- **Admin**: admin@ffarena.com / admin123
- **Player 1**: sniper@example.com / player123
- **Player 2**: ghost@example.com / player123

## Key Commands

- `pnpm --filter @workspace/api-server run dev` — API server dev
- `pnpm --filter @workspace/freefire-tournament run dev` — Frontend dev
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API hooks
- `pnpm --filter @workspace/db run push` — Push DB schema changes
