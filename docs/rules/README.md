# Rules

Tool-agnostic development rules for this repo. Plain markdown — no tool-specific format.

`AGENTS.md` at the repo root is the always-on entry point and links here. These files are
the detail, loaded when they're relevant to what you're working on.

| File                                                         | Read when working on                                      |
| ------------------------------------------------------------ | --------------------------------------------------------- |
| [01-project-structure.md](01-project-structure.md)           | Anything — layout, the `@/` alias, where a change goes    |
| [02-nextjs-app-router.md](02-nextjs-app-router.md)           | `app/**` — Next 16, server vs client, route handlers, env |
| [03-design-system.md](03-design-system.md)                   | UI — Tailwind tokens, shadcn on Base UI, icons            |
| [04-typescript-conventions.md](04-typescript-conventions.md) | `*.ts`, `*.tsx` — typegen, status unions, readability     |
| [05-testing.md](05-testing.md)                               | tests — there is no suite yet; what CI checks instead     |
| [06-coding-standards.md](06-coding-standards.md)             | naming, formatting, dependencies, commits — quick index   |

## Related docs

- `docs/agents/code-style.md` — the deep code-style reference (how code is _shaped_ here)
- `docs/adr/` — architecture decision records, and when to write one
- `CONTEXT.md` — domain glossary (repo root)

## Consumers

- **Every agent** reads `AGENTS.md`, which points here
- **Cursor** additionally auto-loads `.cursor/rules/*.mdc`, which are thin glob-scoped
  stubs that reference these files — so Cursor pulls the right one in automatically when
  you open a matching file. Edit the rule content **here**, not there
- **Claude Code** reads `CLAUDE.md` → `AGENTS.md`

## Editing

Change the content in this directory. The `.cursor/rules/*.mdc` stubs only carry
frontmatter (`globs`, `alwaysApply`, `description`) plus an `@docs/rules/...` reference —
update a stub only when the glob or the routing changes.

Prettier formats these files (`npm run format:check`), so keep tables aligned or let
`npm run format` do it.

Run `/refresh-docs` when these drift from the code.
