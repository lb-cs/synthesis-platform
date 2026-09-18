# Testing

Applies to: `**/__tests__/**`, `*.test.ts`, `*.test.tsx`.

## There is no test suite yet

No test runner is installed and there is no `test` script in `package.json`. The only
automated checks today are the three static ones, and CI runs exactly these:

```bash
npm run lint           # ESLint (eslint-config-next + Prettier conflicts off)
npm run format:check   # Prettier — sorts Tailwind classes too, so class order counts
npm run type-check     # next typegen && tsc --noEmit
npm run build          # what CI runs last
```

Until a runner lands, "tests pass" means those pass. When handing over a change, say
plainly that it is unverified by tests — don't imply coverage that doesn't exist.

## When a runner is added

Choosing one is a decision, not a side effect of a feature PR — raise it on its own. The
natural fit for this stack is Vitest with React Testing Library; whatever lands, wire it
as `npm run test` and add it to `.github/workflows/ci.yml` in the same change.

Tests live next to what they cover:

```
lib/__tests__/                    pure functions — the bulk of the suite
components/__tests__/             client components, through their rendered behaviour
app/api/<name>/__tests__/         route handlers, called as functions with a Request
```

## Guidelines

These apply from the first test onward.

- Test behaviour, not implementation. A test reads like a specification — "search with
  an empty query shows the prompt" — and survives a refactor that keeps behaviour.
- Test at seams: the exported function, the rendered component, the route handler. Never
  a private helper, never internal state.
- Mock at the transport boundary — `fetch` or the one `lib/` function that calls it — not
  the component under test, and not React.
- Expected values come from an independent source of truth — a known-good literal, a
  worked example — never recomputed the way the code computes them.
- A bug fix gets a test that fails before the fix. A test failing because behaviour
  intentionally changed gets **updated**, never skipped or deleted.
- Never make a suite green by weakening it, and never pin a known bug as expected
  behaviour — leave it uncovered and say so.

The `/tdd` skill (`.agents/skills/tdd/`) is the long-form version: seams, anti-patterns,
and the red → green loop.
