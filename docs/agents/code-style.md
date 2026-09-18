# Code Style

How code in this repo is written. Agents: follow this when adding or editing code. It is
about **shape and readability**, not architecture — `docs/rules/` covers where things go.

Prettier owns the mechanical bits: single quotes, 90 columns, and Tailwind class order
(`prettier-plugin-tailwindcss` sorts every `className`, `cn()` and `cva()` string — don't
hand-order classes, and don't fight the sort). ESLint runs `eslint-config-next` with
Prettier's conflicts turned off. Everything below is what the formatter can't enforce.

---

## 1. Arrow functions get braces

Always braces, body on its own line — even for one statement.

```ts
// ✅
const appendItems = (existing: Item[], incoming: Item[]): Item[] => {
  const seen = new Set(existing.map((item) => item.id));
  return [...existing, ...incoming.filter((item) => !seen.has(item.id))];
};

// ❌ implicit return with real logic hiding in it
const nextCursor = (page) =>
  page.items.length ? page.items[page.items.length - 1].createdAt : null;
```

The only bare-expression arrows allowed are trivial one-liners — a property read, a
negation, a cast — that fit on one line and contain no branching:

```ts
items.map((item) => item.id);
items.filter((item) => !seen.has(item.id));
setOpen((current) => !current);
```

If you find yourself wanting a line break inside a bare arrow, it needed braces.

---

## 2. Break chains into named steps

Don't compose four operations into one expression. Name the intermediate, then act on it.

```ts
// ❌
return (await (await fetch('/api/items')).json()).items.map((i) =>
  i.author ? i.author.name : null,
);

// ✅
const res = await fetch('/api/items');

if (!res.ok) {
  return [];
}

const page: ItemsPage = await res.json();

return page.items.map((item) => {
  return item.author?.name ?? null;
});
```

A named `const` is free. It gives the reader — and the debugger — a place to stand.

---

## 3. Guard clauses, not nesting

Handle the bail-outs first, return early, then write the happy path flat at the bottom.

```ts
// ✅
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return Response.json({ error: 'q is required' }, { status: 400 });
  }

  const results = await search(query);

  if (results.length === 0) {
    return Response.json({ items: [] });
  }

  // happy path, flat
  return Response.json({ items: results });
}
```

Never `else` after a `return`. Never nest an `if` inside an `if` when a combined guard or
an early return would flatten it.

---

## 4. Ternaries: one, simple, assigned to a name

A ternary is fine when it picks between two values and lands in a named const:

```ts
const method = options.method ?? 'GET';
const label = state.kind === 'loading' ? 'Checking…' : 'Call /api/health';
```

**Never nest them.** Never chain them into a pseudo-switch. Three-plus branches become
sequential guarded returns, a lookup object, or a `switch`:

```ts
// ✅
function getEmptyText(status: FeedStatus, error: string | null) {
  if (status === 'error') {
    return error ?? 'Something went wrong.';
  }

  if (status === 'idle') {
    return 'Run a search to get started.';
  }

  return 'No results.';
}
```

For a fixed set of keys mapping to values, use a lookup object typed
`Record<Key, string>` — see §9.

---

## 5. `function` declarations for named work, arrows for callbacks

Module-level helpers and anything with a name that will appear in a stack trace are
**function declarations**. Arrow functions are for callbacks and inline handlers where
the surrounding form already requires them.

```ts
// ✅ module-level helper
function buildUrl(path: string, query?: Record<string, string>): string {
  // ...
}

// ✅ arrow: it is a callback
items.forEach((item) => {
  register(item);
});
```

React components are `export default function Page()` (routes) or a named
`export function HealthCheck()` (everything else) — never `const Page = () => {}`. Route
handlers export the HTTP method by name: `export function GET()`. Handlers declared inside
a component are `async function check() {}`, not `const check = async () => {}`.

---

## 6. Blank lines are structure

One blank line between logical chunks: after guards, around a `const` that feeds the next
block, before a `return`. Dense walls of statements are harder to scan than one extra
line.

```ts
const res = await fetch('/api/health');
const body = await res.json();

if (!res.ok) {
  throw new Error(`HTTP ${res.status}`);
}

setState({ kind: 'ok', body: JSON.stringify(body, null, 2) });
```

---

## 7. Comments: one line, say why, move on

Short. Explain the reason or the gotcha — never restate the code, never write a
paragraph.

```ts
// ✅
// Must come last: turns off ESLint rules that conflict with Prettier.
// fetch rejects only on network-level failures (offline, DNS, refused).
// Base UI's Button renders a <button>; opt out when the child is a <Link>.
```

**Two lines is the cap, one is the norm.** Both readers pay for every line — a person
skimming the file, and an agent pulling it into a limited context window — so a comment
has to earn its width. Past two lines, the code wanted a named function instead.
Exception: a genuinely non-obvious framework workaround earns a 2–3 line explanation.

The cap covers JSDoc. A `/** … */` on an export is a one-line note on **when to reach for
it** — never a restatement of the signature, and never `@param`/`@returns` blocks
repeating what the types already say. A **file-level docblock** is the one deliberate
exception: write one when a module's reason for existing is not answerable from its code
("why are there two of these?").

---

## 8. Result-returning calls: narrow, bail, continue

Check before you use. `fetch` throws only on network failure — a 500 resolves fine — so
check `res.ok` before touching the body, and `try`/`catch` only at the boundary where
the failure turns into state or a response. Never wrap a call that returns a result
(`{ ok, data }`, `string | null`) in `try`/`catch`, and never read `data` before narrowing
on `ok`.

```ts
const res = await fetch('/api/health');

if (!res.ok) {
  setState({ kind: 'error', message: `HTTP ${res.status}` });
  return;
}

setState({ kind: 'ok', body: await res.text() });
```

When a typed transport lands (a single `apiFetch`-style helper that never throws), every
call site narrows on it the same way and `try`/`catch` disappears from features. Don't
leak a raw error message from a dependency to the UI — convert it to a written sentence.

---

## 9. JSX copy and conditional text

Ternaries are fine for simple, one-level conditions. Avoid **nested ternaries in JSX**
when the result is user-facing copy — headings, labels, empty states, error messages.
Nested ternaries make strings hard to scan, harder to edit, and easy to get wrong when a
third branch appears.

```tsx
// ❌ nested ternaries for copy
<p className="text-sm text-muted-foreground">
  {state.kind === 'error'
    ? (state.message ?? 'Something went wrong.')
    : state.kind === 'idle'
      ? 'Run a search to get started.'
      : 'No results.'}
</p>
```

```tsx
// ✅ compute before JSX — lookup map for the common axis, if for the special branch
const EMPTY_TEXT: Record<SearchStatus, string> = {
  idle: 'Run a search to get started.',
  loaded: 'No results.',
};

let emptyText = EMPTY_TEXT[status];
if (state.kind === 'error') {
  emptyText = state.message ?? 'Something went wrong.';
}

// ...

<p className="text-sm text-muted-foreground">{emptyText}</p>;
```

A **single** ternary for a binary choice is fine, in JSX or in a class list:

```tsx
<Button disabled={state.kind === 'loading'}>
  {state.kind === 'loading' ? 'Checking…' : 'Call /api/health'}
</Button>
```

```tsx
className={cn('rounded-md p-4', isSelected ? 'bg-muted' : 'bg-background')}
```

Rule of thumb: one level → OK. Nested, choosing among strings → compute before render.
Copy that will grow another case → lookup map or helper from the start.

---

## 10. Components

- **Server by default.** No `'use client'` unless the file uses state, effects, event
  handlers, or browser APIs — and then it goes on the leaf that needs it, not the page.
- Order inside a component: constants → props destructure → hooks → derived values →
  handlers → early returns for loading/error → the tree.
- **Styling is Tailwind in `className`.** `cn()` (from `@/lib/utils`) merges conditional
  classes; `cva()` declares variants. No `style={{}}` for anything a utility covers, no
  `@apply` in CSS for component styling.
- **Colors and spacing come from the theme.** `bg-background`, `text-muted-foreground`,
  `border-border`, `rounded-lg` — the tokens declared in `app/globals.css`. Never an
  arbitrary value for a color that has a token (`bg-[#fff]`, `text-[#666]`). See
  `docs/rules/03`.
- **shadcn/ui primitives are the building blocks.** Compose from `components/ui`; don't
  restyle a `<button>` from scratch. A pattern two features style the same way twice is a
  primitive.
- A component past ~150 lines with two unrelated view states usually wants splitting.

---

## 11. Route handlers and server code: guard → validate → delegate

```ts
export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createItemSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: 'Invalid item' }, { status: 400 });
  }

  const item = await createItem(parsed.data);

  return Response.json(item, { status: 201 });
}
```

- The handler validates and delegates. Real work lives in a function under `lib/` that a
  test can call without HTTP. A handler that contains logic is a `lib/` function in the
  wrong file.
- Error bodies are **user-facing** — a short written sentence, never a stack trace or a
  dependency's raw message.
- Server-only secrets are read on the server. Nothing without the `NEXT_PUBLIC_` prefix
  reaches the browser, and nothing with it is secret.

---

## 12. Naming

- **Files** — kebab-case throughout: `health-check.tsx`, `button.tsx`, `utils.ts`. Routes
  follow Next's fixed names: `page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`
- **Components** — PascalCase exports from kebab-case files: `HealthCheck` in
  `health-check.tsx`
- **Hooks** — `use-thing.ts` exporting `useThing`
- **Constants** — `SCREAMING_SNAKE_CASE` at the top of the file: `PAGE_SIZE = 20`
- **Booleans** — `is` / `has` / `can`: `hasMore`, `isSelected`, `canEdit`
- **Functions** — verb first: `fetchItems`, `buildUrl`, `getEmptyText`, `reset`
- **Lifecycle state** — a discriminated union, not a bag of booleans. `HealthState` in
  `components/health-check.tsx` is the reference:
  `{ kind: 'idle' } | { kind: 'loading' } | { kind: 'ok'; body } | { kind: 'error'; message }`
  — `idle` is not the same as empty, and each branch carries only the data it has

---

## 13. Types

- `import type { … }` for type-only imports, on their own line. Inline `type` in a mixed
  import is fine when the value import is the point (`import { cva, type VariantProps }`)
- Return-shape unions get a named type above the function, and the discriminant is the
  first thing a caller narrows on
- `as` casts are used deliberately and sparingly — don't sprinkle them to silence the
  compiler
- Use the generated route types. `PageProps<'/route'>` and `LayoutProps<'/'>` are global
  after `next typegen`; don't hand-write a `params` shape

### Readability beats exhaustiveness

A type is read far more often than it is written. When one gets clever enough that you
have to decode it, it has stopped being a guardrail and become a puzzle — take the
version a reader can hold in their head, even if it lets a little more through.

You have gone too far when you see a generic parameter that exists only to be mapped
over, a chain of `K extends 'literal' ? A : B`, or a type you had to compile to
understand. If a constraint can't be expressed simply, write it down as prose and rely on
review.

### Narrow once, at the shape you actually get

Don't write defensive `typeof` ladders for inputs this repo never produces. Name the
shapes you really receive, cast once, and let the rest fall through.

```ts
// ❌ four branches, three of which nothing in this codebase can reach
if (error instanceof Error) return error.message;
if (typeof error === 'string') return error;
if (typeof (error as { message?: unknown })?.message === 'string') { … }
return undefined;

// ✅ one narrow at the shape a catch block actually sees
const message = err instanceof Error ? err.message : 'Unknown error';
```

Missing an edge case this codebase cannot produce is not a bug. A helper nobody wants to
read is. This applies to defensive runtime checks, not to real failure handling — see §8.

---

## 14. Logging

There is no logger yet. Nothing in the client logs in production paths — a failure a user
should know about is rendered, not logged.

- **Never `console.*` in shipped code.** An error a user should see goes into state and
  gets rendered; an error they shouldn't see is a bug, not a log
- On the server (route handlers, server components), a returned error response does not
  also need a log line — that reports one failure twice
- If a real logging need appears — structured fields, an external sink — write it down as
  an ADR before adding a logging path

---

## 15. Smells to avoid

- Nested ternaries, or a ternary whose branches contain more ternaries
- Deeply chained expressions where an intermediate `const` would name the thing
- `else` blocks after a `return`
- Functions past ~60 lines — extract a named helper
- Paragraph comments, or JSDoc restating what the signature already says
- A type you had to compile to understand — mapped types, conditional types, or a generic
  parameter that only exists to be mapped over (§13)
- A ladder of `typeof` / `instanceof` checks covering shapes this repo never produces
- Reading a response body before checking `res.ok`
- `try`/`catch` around a call that returns a result instead of throwing
- `'use client'` on a page or layout when only one leaf needs it
- A hardcoded color, or an arbitrary Tailwind value where a theme token exists
- `style={{}}` or `@apply` doing a utility class's job
- A raw `<button>` or `<input>` styled by hand when `components/ui` has the primitive
- Logic inside a route handler that a `lib/` function should own
- A `console.*` call in shipped code
