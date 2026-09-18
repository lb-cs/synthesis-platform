# Synthesis Platform

AI-assisted research workspace — CECS 491, Team Quintessential Algorithms.

## Quick start

You need **Node 24**, **npm 11**, **Docker** (running), and the
[Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

**1. Install dependencies**

```bash
npm ci
```

**2. Start Supabase**

```bash
supabase start
```

It prints an API URL and a publishable key. You need both in the next step.

**3. Create `.env`**

```bash
cp .env.example .env
```

Paste in the two values from step 2:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

**4. Run the app**

```bash
npm run dev
```

Open <http://localhost:3000>.

**5. Sign in**

Go to <http://localhost:3000/login> and enter any email. No real email is sent — the
6-digit code lands in the local inbox at <http://127.0.0.1:54324>. Copy it into the form.

**Handy URLs**

| What                         | Where                    |
| ---------------------------- | ------------------------ |
| App                          | <http://localhost:3000>  |
| Sign-in codes (local inbox)  | <http://127.0.0.1:54324> |
| Supabase Studio (DB browser) | <http://127.0.0.1:54323> |

Done for the day? `supabase stop`.

---

## What's here

This repo is the project foundation: Next.js (App Router), Tailwind CSS v4,
shadcn/ui, Supabase (auth + Postgres), ESLint, Prettier, and CI. Email OTP login
works; no application tables or features yet.

## Supabase: cloud instead of local

Local is the default for day-to-day work — no rate limits, no shared state, emails
land in a local inbox. `supabase/config.toml` already wires the one-time-code email
template (`supabase/templates/magic-link.html`).

If you need a cloud project instead, create one at <https://supabase.com/dashboard>,
then:

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
