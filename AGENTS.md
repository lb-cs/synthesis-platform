<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md

Entry point for every AI coding agent working in this repo. Keep it short — the detail
lives in `docs/rules/`, loaded when relevant. The block above is owned by Next.js; leave
it in place.

## Project overview

Synthesis Platform — an AI-assisted research workspace. CECS 491, Team Quintessential
Algorithms. Built so far: Supabase auth (email one-time code, route guard in `proxy.ts`),
the schema in `supabase/migrations/` (projects, sources, chunks, chat, citations), and
the first features over it — projects (dashboard, create, REST API in
`app/api/projects/`) and the sources list with remove. Upload, processing, and chat are
not built; [architecture](docs/design/architecture.md) tracks status per screen.

**Tech stack**: Next.js 16 (App Router) / React 19 / TypeScript, Tailwind CSS v4,
shadcn/ui on Base UI, lucide-react, Supabase (`@supabase/ssr`), zod + react-hook-form.
Node 24, npm 11. One package at the repo root.

**What the product must become** is specified in [`docs/product/`](docs/product/README.md)
(use cases UC-01 – UC-20, requirements, NFR targets). How it's built is in
[`docs/design/`](docs/design/): [architecture](docs/design/architecture.md) (route
handlers and server actions over `lib/`, Supabase Auth, RLS — no controller layer) and
[data model](docs/design/data-model.md). Map: [`docs/README.md`](docs/README.md). The
code and `CONTEXT.md` win on names and decisions.

## Common commands

```bash
npm ci                 # install — use ci, not install, to respect the lockfile
npm run dev            # dev server on :3000 — you run this, not an agent
npm run lint           # ESLint (lint:fix to autofix)
npm run format:check   # Prettier (format to write)
npm run type-check     # next typegen && tsc --noEmit — the only correct typecheck
npm run build          # production build — CI runs it last
npx shadcn@latest add <name>   # add a UI primitive to components/ui
```

There is **no test script yet** — see [05-testing](docs/rules/05-testing.md).

## Rules

Read the file that matches what you're touching. Cursor loads these automatically via
`.cursor/rules/*.mdc` stubs; other agents should open them as needed.

| Rules file                                                           | Read when working on                                      |
| -------------------------------------------------------------------- | --------------------------------------------------------- |
| [01-project-structure](docs/rules/01-project-structure.md)           | Anything — layout, the `@/` alias, where a change goes    |
| [02-nextjs-app-router](docs/rules/02-nextjs-app-router.md)           | `app/**` — Next 16, server vs client, route handlers, env |
| [03-design-system](docs/rules/03-design-system.md)                   | UI — Tailwind tokens, shadcn on Base UI, icons            |
| [04-typescript-conventions](docs/rules/04-typescript-conventions.md) | `*.ts`, `*.tsx` — typegen, status unions, readability     |
| [05-testing](docs/rules/05-testing.md)                               | tests — there is no suite yet; what CI checks instead     |
| [06-coding-standards](docs/rules/06-coding-standards.md)             | naming, formatting, dependencies, commits — quick index   |

⚠️ **Read `docs/agents/code-style.md` before writing or editing code.** It is the deep
reference for how code is _shaped_ here — braces on arrow functions, guard clauses over
nesting, named intermediates over long chains, no nested ternaries, comment style.

`CONTEXT.md` is the domain glossary — read it before naming anything new, and add the
word there when you do.

## Things that will bite you

- ⚠️ **Never guess a library's API — read its docs first.** Next.js: `node_modules/next/dist/docs/`.
  Everything else (Supabase, shadcn, zod, react-hook-form, …): the Context7 MCP
  (`resolve-library-id` → `query-docs`). Training data is stale for every dependency here.
  Copy the documented pattern; don't invent a wrapper around it
- ⚠️ **This is Next.js 16.** Routing, caching, and data-fetching APIs differ from
  training data. Read `node_modules/next/dist/docs/01-app/` before touching them
- ⚠️ **`tsc --noEmit` alone fails on a fresh clone.** `next-env.d.ts` is gitignored and
  the `PageProps` / `LayoutProps` globals are generated into `.next/types/`. Always
  `npm run type-check`, which runs `next typegen` first
- ⚠️ **shadcn here is the Base UI flavour, not Radix.** Composition is
  `render={<Link … />} nativeButton={false}`, not `asChild`. Examples copied from the
  web often won't typecheck — read the generated file in `components/ui` for the real
  signature. See [03-design-system](docs/rules/03-design-system.md)
- ⚠️ **Prettier sorts Tailwind classes.** A hand-ordered `className` fails
  `format:check`. Run `npm run format` rather than reordering by hand
- ⚠️ **`next dev` rewrites the top of this file.** The `nextjs-agent-rules` block comes
  back on every run — commit it, don't delete it
- ⚠️ **RLS is the ownership check.** Query through `createClient()` from
  `lib/supabase/server.ts`, never the service role — it bypasses RLS and leaks other
  users' rows. Every route handler and server action still calls `getSupabaseUser()` and
  validates with zod; server actions are public endpoints
- ⚠️ **Deleting a source row leaves its file in Storage.** Remove the file through the
  Storage API too — `deleteSource` in `lib/sources.ts` is the pattern
- ⚠️ **Regenerated DB types fail `format:check`.** After a migration, run
  `npx supabase gen types --local > lib/supabase/database.types.ts`, then `npm run format`
- **Everything is a server component by default.** `'use client'` goes on the smallest
  leaf that needs it, never on a page or layout for one interactive child
- **`NEXT_PUBLIC_*` is inlined into the browser bundle.** Never a secret behind that
  prefix
- **There is no test suite.** Lint, format, typecheck, and build are the whole CI. Say
  so when handing over a change — don't imply coverage that doesn't exist

## Project conventions

- **Git commits** — `type: description (CECS491-NN)`. Types: `feat`, `fix`, `refactor`,
  `docs`, `style`, `test`, `chore`. Jira key in parentheses at the end when there is one
- **Architecture decisions** — recorded as ADRs in `docs/adr/`. Write one only when the
  decision is hard to reverse, surprising without context, and a real trade-off. Most
  work needs none. **Offer, don't assume** — say a decision looks like it qualifies and
  ask before writing the file. See [docs/adr/README.md](docs/adr/README.md)
- **Issue tracker** — Jira, project `CECS491`:
  <https://quintessentialalgorithms.atlassian.net/browse/CECS491>
- **CI** — `.github/workflows/ci.yml` runs lint → format:check → type-check → build on
  every pull request

## Best practices by default

Don't just make lint and types pass — implement the idiomatic, maintainable solution:

- Prefer the fix that addresses the root cause over one that papers over a symptom
- Favor loose coupling: route files compose, `components/` render, `lib/` computes
- Run the typecheck and lint after non-trivial changes, not just a visual check of the
  diff
- No TypeScript overload stacks: one signature with a union return, narrowed at the call
  site
