# Synthesis Platform

AI-assisted research workspace — CECS 491, Team Quintessential Algorithms.

This repo is the project foundation: Next.js (App Router), Tailwind CSS v4,
shadcn/ui, Supabase (auth + Postgres), ESLint, Prettier, and CI. Email OTP login
works; no application tables or features yet.

## Prerequisites

- Node 24 (see `.nvmrc`)
- npm 11

## Setup

```bash
npm ci
cp .env.example .env.local   # then fill in the Supabase values (below)
npm run dev
```

Open <http://localhost:3000>.

### Supabase

Two options. Local is the default for day-to-day work — no rate limits, no shared
state, emails land in a local inbox.

**Local (recommended):** needs Docker and the
[Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

```bash
supabase start          # prints the API URL and publishable key
```

Put the URL (`http://127.0.0.1:54321`) and the publishable key it prints into
`.env.local`. Sign-in codes arrive in the local inbox at <http://127.0.0.1:54324>;
Studio is at <http://127.0.0.1:54323>. `supabase/config.toml` already wires the
one-time-code email template (`supabase/templates/magic-link.html`).

**Cloud:** create a project at <https://supabase.com/dashboard>, then:

1. **Project Settings → API Keys.** Copy the project URL and the `sb_publishable_...`
   key into `.env.local`.
2. **Authentication → Email Templates → Magic Link.** Paste in the body of
   `supabase/templates/magic-link.html` — it must include `{{ .Token }}`, or Supabase
   emails a link instead of a code and the login form won't work.

Gotcha: without custom SMTP, a cloud project's built-in mailer allows only a
handful of emails per hour. Fine for one person, tight for five — another reason
to use local for development.

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
every pull request.

## Layout

```
app/                  App Router routes
  page.tsx            Landing page (public)
  api/health/route.ts GET /api/health → { "status": "ok" } (public)
  login/              Sign-in page (public): page.tsx, login-form.tsx, actions.ts, schema.ts
  dashboard/page.tsx  Placeholder page after sign-in (protected)
components/ui/        shadcn/ui components (add more: npx shadcn@latest add <name>)
lib/supabase/         Supabase clients from the docs: client.ts, server.ts, proxy.ts
proxy.ts              Calls lib/supabase/proxy.ts on every request (Next 16's "middleware")
public/               Static assets
```

## Auth

Passwordless email OTP via Supabase Auth. Signup and login are the same flow:
enter an email, get a 6-digit code, enter the code. Unknown emails get an
account automatically.

The setup follows Supabase's
[Next.js server-side auth guide](https://supabase.com/docs/guides/auth/server-side/nextjs)
file for file.

- **Route guard:** `lib/supabase/proxy.ts`. Only `/`, `/login`, and `/api/health` work
  signed out; anything else redirects to `/login`. Add a path to `PUBLIC_PATHS` there to
  open it.
- **Server code:** `const supabase = await createClient()` from
  `@/lib/supabase/server`, then `supabase.auth.getClaims()` to read the user.
  Never trust `getSession()` on the server — it doesn't verify the JWT.
- **Client code:** `createClient()` from `@/lib/supabase/client`.
- **Login form:** `app/login/login-form.tsx` — react-hook-form + zod, shadcn `Field`.
  Server actions in `app/login/actions.ts` (`sendCode`, `verifyCode`, `signOut`).

Import alias: `@/*` maps to the repo root (e.g. `@/components/ui/button`).

## Working in this repo

- `AGENTS.md` — entry point for AI coding agents; the rules in `docs/rules/` are for
  humans too
- `docs/agents/code-style.md` — how code is shaped here
- `CONTEXT.md` — domain glossary (skeleton until the first feature lands)
- `docs/adr/` — architecture decision records

## Project tracking

Jira: <https://quintessentialalgorithms.atlassian.net/browse/CECS491>
