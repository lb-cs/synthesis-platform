# Project Structure

Applies to: everything. Read this first.

## Layout

One npm project at the repo root — a single `package.json`, a single lockfile, a single
Prettier and ESLint config. Everything runs from the root.

```
app/              App Router routes — layout.tsx, page.tsx, api/*/route.ts
components/       app components (kebab-case files, PascalCase exports)
components/ui/    shadcn/ui primitives — added with `npx shadcn@latest add <name>`
lib/              shared, framework-free utilities and the real work behind route handlers
public/           static assets
docs/             these rules, code style, ADRs
.agents/skills/   agent skills (source); .claude/skills/ symlinks to them
.cursor/rules/    thin glob-scoped stubs pointing at docs/rules/
```

`hooks/` is aliased in `components.json` but does not exist yet. Create it the first
time a hook is shared by two components; until then a hook lives next to its component.

## Import alias

`@/*` maps to the repo root — declared in `tsconfig.json`, mirrored in
`components.json` for the shadcn CLI.

```ts
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
```

`components/ui/*` files import `cn` straight from the `cn` package — that is how the
shadcn generator writes them, and it is fine to leave as generated. Everything else
imports from `@/lib/utils`.

## Where a change goes

| You are changing                       | Where                                                   |
| -------------------------------------- | ------------------------------------------------------- |
| A route, page, or layout               | `app/` — thin; delegate rendering to `components/`      |
| An HTTP endpoint                       | `app/api/<name>/route.ts` — validate, then call `lib/`  |
| Logic a test should reach without HTTP | `lib/`                                                  |
| A shared UI primitive                  | `components/ui/` via the shadcn CLI — see 03            |
| How something looks                    | Tailwind classes + tokens in `app/globals.css` — see 03 |
| Anything about how code is _shaped_    | `docs/agents/code-style.md`                             |

Route files stay thin: a `page.tsx` composes components and passes data; it does not own
state or fetch logic that another route would want. A component used by two routes lives
in `components/`, not under either route.
