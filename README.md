# Synthesis Platform

AI-assisted research workspace — CECS 491, Team Quintessential Algorithms.

This repo is the project foundation only: Next.js (App Router), Tailwind CSS v4,
shadcn/ui, ESLint, Prettier, and CI. No auth, database, or features yet.

## Prerequisites

- Node 24 (see `.nvmrc`)
- npm 11

## Setup

```bash
npm ci
cp .env.example .env.local   # optional — nothing is required yet
npm run dev
```

Open <http://localhost:3000>.

## Scripts

| Script               | What it does                              |
| -------------------- | ----------------------------------------- |
| `npm run dev`        | Start the dev server                      |
| `npm run build`      | Production build                          |
| `npm run start`      | Serve the production build                |
| `npm run lint`       | ESLint (`lint:fix` to auto-fix)           |
| `npm run format`     | Prettier write (`format:check` to verify) |
| `npm run type-check` | Generate route types, then `tsc --noEmit` |

CI (`.github/workflows/ci.yml`) runs lint, format check, type-check, and build on
every pull request and on pushes to `main`.

## Layout

```
app/                  App Router routes
  api/health/route.ts GET /api/health → { "status": "ok" }
  example/page.tsx    Example page using shadcn/ui + the health endpoint
components/ui/        shadcn/ui components (add more: npx shadcn@latest add <name>)
components/           App components
lib/                  Shared utilities
public/               Static assets
```

Import alias: `@/*` maps to the repo root (e.g. `@/components/ui/button`).

## Project tracking

Jira: <https://quintessentialalgorithms.atlassian.net/browse/CECS491>
