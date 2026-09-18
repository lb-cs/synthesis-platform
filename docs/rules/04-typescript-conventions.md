# TypeScript Conventions

Applies to: `*.ts`, `*.tsx`.

## Strict, and typechecked through Next

`tsconfig.json` is `strict: true`. The typecheck is **`npm run type-check`**, which runs
`next typegen` and then `tsc --noEmit`. A bare `tsc --noEmit` on a fresh clone fails:
`next-env.d.ts` is gitignored and the `PageProps` / `LayoutProps` globals live in the
generated `.next/types/`, so `typegen` has to run first. CI does it the same way.

## Generated route types

`next typegen` generates a typed route table from `app/`. Use it:

```tsx
export default function RootLayout({ children }: LayoutProps<'/'>) { … }
export default function PostPage({ params }: PageProps<'/posts/[slug]'>) { … }
```

The generics are the literal route path. Don't hand-write a `params` shape — the
generated one is the one that matches the file system, and a typo in a route string
becomes a compile error.

## Imports

- `import type { … }` for type-only imports, on their own line. Inline `type` in a mixed
  import when the value is the point (`import { cva, type VariantProps }`)
- `@/*` for anything inside the repo; relative paths only within the same directory

Order: external packages → type-only imports → `@/lib`, `@/components` → local. One blank
line between groups (see 06).

## No overload stacks

Give a function one signature with a union return (`string | null`) and let callers
narrow at the call site. A non-null assertion is fine where an invariant guarantees it —
document the invariant on the function.

## Readability beats exhaustiveness

A type is read far more often than it is written. When one gets clever enough that you
have to decode it, it has stopped being a guardrail and become a puzzle — take the
version a reader can hold in their head, even if it lets a little more through.

You have gone too far when you see a generic parameter that exists only to be mapped
over, a chain of `K extends 'literal' ? A : B`, or a type you had to compile to
understand. If a constraint can't be expressed simply, write it down as prose in the
relevant rules file and rely on review.

## Narrow once, at the shape you actually get

Don't write defensive `typeof` / `instanceof` ladders for inputs this repo never
produces. Name the shapes you really receive, cast once, and let the rest fall through.
Missing an edge case this codebase cannot produce is not a bug; a helper nobody wants to
read is. This applies to defensive runtime checks — not to `error` handling on calls that
genuinely fail.

## Const assertions for literal sets

```ts
const SORT_ORDERS = ['newest', 'oldest'] as const;
type SortOrder = (typeof SORT_ORDERS)[number]; // 'newest' | 'oldest'
```

## Status, not booleans

Model a lifecycle as a discriminated union, not a bag of booleans. `HealthState` in
`components/health-check.tsx` is the reference:

```ts
type HealthState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; body: string }
  | { kind: 'error'; message: string };
```

`idle` is not the same as empty, and each branch carries only the data that branch has —
so `state.body` cannot be read without narrowing on `kind` first.

## Component props

Extend the element or primitive you wrap rather than re-declaring its props:
`React.ComponentProps<'div'> & { size?: 'default' | 'sm' }` — the shape every
`components/ui` file uses. Variant props come from `VariantProps<typeof buttonVariants>`.
