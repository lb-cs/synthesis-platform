# Coding Standards

Applies to: `*.ts`, `*.tsx`, `*.mjs`.

⚠️ **`docs/agents/code-style.md` is the deep reference** — braces on arrow functions,
guard clauses over nesting, named intermediates over long chains, no nested ternaries,
comment style. Read it before writing or editing code. What follows is the quick index.

## Formatting and checks

Prettier owns the mechanical bits; ESLint owns the rest. One config each, at the root.

```bash
npm run format         # Prettier write
npm run format:check   # verify (CI)
npm run lint           # ESLint (CI) — lint:fix to autofix
npm run type-check     # next typegen && tsc --noEmit (CI)
npm run build          # next build (CI)
```

| Setting     | Value                                                               |
| ----------- | ------------------------------------------------------------------- |
| quotes      | single                                                              |
| print width | 90                                                                  |
| indent      | 2 spaces (`.editorconfig` agrees)                                   |
| Tailwind    | `prettier-plugin-tailwindcss` sorts classes in JSX, `cn()`, `cva()` |
| ESLint      | `eslint-config-next` (core-web-vitals + typescript), Prettier last  |

Prettier also formats Markdown in `docs/`, so run `format:check` after editing a rule
file. It has no parser for `.mdc` — the Cursor stubs are skipped, which is expected.

## Naming

| Thing              | Convention                  | Example                                  |
| ------------------ | --------------------------- | ---------------------------------------- |
| Files              | kebab-case                  | `health-check.tsx`, `button.tsx`         |
| Route files        | Next's fixed names          | `page.tsx`, `layout.tsx`, `route.ts`     |
| Components         | PascalCase export           | `HealthCheck`, `CardHeader`              |
| Hooks              | `use-thing.ts` / `useThing` | `use-search.ts` → `useSearch`            |
| Variables          | camelCase                   | `currentCursor`                          |
| Constants          | `SCREAMING_SNAKE_CASE`      | `PAGE_SIZE`, `MAX_QUERY_LENGTH`          |
| Types / interfaces | PascalCase                  | `HealthState`, `ItemsPage`               |
| Booleans           | `is` / `has` / `can`        | `hasMore`, `isSelected`                  |
| Functions          | verb first                  | `fetchItems`, `buildUrl`, `getEmptyText` |
| Route handlers     | HTTP method, named export   | `export function GET()`                  |

## Import order

1. External packages (`react`, `next/link`, `lucide-react`)
2. Type-only imports (`import type`)
3. Internal modules (`@/lib/…`)
4. Components (`@/components/…`)

One blank line between groups. `app/example/page.tsx` is the reference.

## Functions

- Keep them small — past ~60 lines, extract a named helper.
- Single responsibility; prefer pure functions in `lib/`.
- Default parameters over conditional assignment.

## Errors

Components and `lib/` return typed results or hold a `status` union in state. Route
handlers return an error `Response` with a written message. Don't mix the two idioms in
one layer, and don't `try`/`catch` a call that returns a result (see
`docs/agents/code-style.md` §8).

## Comments

Explain **why**, not what. One line is the norm, two the cap — past that the code wanted
a named function. JSDoc on an export is a one-line note on when to reach for it, never a
restatement of the signature. Full treatment in `docs/agents/code-style.md` §7.

## Dependencies

- Prefer platform APIs, existing dependencies, and official Next / React / shadcn
  packages. shadcn primitives are added with the CLI, not installed as a package.
- Before adding a dependency, verify maintenance activity, current compatibility with
  Next 16 / React 19, security posture, documentation, and meaningful community adoption.
- Do **not** add obscure, unmaintained, or low-adoption packages without explicit
  approval.
- If no established dependency exists, explain the platform limitation and propose a
  dependency-free fallback before reaching for a niche package.
- Keep dependencies narrowly scoped — no package for behaviour that existing APIs cover
  safely.

## Security

- Validate every request body and query in the route handler before it reaches `lib/`.
- `NEXT_PUBLIC_*` is public — it is inlined into the browser bundle. Never put a secret
  behind that prefix.
- Server secrets are read from `process.env` on the server only, in one place per
  concern — not scattered through components.
- Never trust a client-supplied identity; derive it on the server once auth exists.

## Accessibility

- Every icon-only control takes an `aria-label`.
- Use the semantic element (`<button>`, `<a>` via `Link`, `<nav>`, `<main>`) — the
  shadcn primitives already do.
- Don't encode meaning in colour alone. Focus rings stay visible (`focus-visible:` is
  already wired into the primitives; don't strip it).

## Git commits

`type: description`. Types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`.
Lower-case, imperative, no trailing period: `feat: add search route`.

## Before you open a PR

- [ ] `npm run format:check` passes
- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes
- [ ] `npm run build` passes
- [ ] Tests pass — or, while there is no suite, the summary says the change is untested
- [ ] No `console.log`, no commented-out code
- [ ] The `nextjs-agent-rules` block in `AGENTS.md` is still there
