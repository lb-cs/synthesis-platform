# Design System

Applies to: `components/**`, `app/**`, anything rendering UI.

The design system is **Tailwind CSS v4 + shadcn/ui**, on the `base-nova` style. That
means the primitives are built on **Base UI** (`@base-ui/react`), not Radix — the API
differs from most shadcn examples online. No other UI kit.

## Tokens

Colors, radius, and fonts are CSS variables in `app/globals.css`, exposed to Tailwind
through `@theme inline`. Light and dark share the same keys — `:root` holds the light
palette, `.dark` the dark one — so any token resolves in both schemes. Use the utility,
never the raw value:

| Group    | Utilities                                                                    |
| -------- | ---------------------------------------------------------------------------- |
| Surfaces | `bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `bg-accent`            |
| Text     | `text-foreground`, `text-muted-foreground`, `text-card-foreground`           |
| Brand    | `bg-primary` / `text-primary-foreground`, `bg-secondary` / `…-foreground`    |
| Feedback | `text-destructive`, `bg-destructive`                                         |
| Lines    | `border-border`, `border-input`, `ring-ring`                                 |
| Radius   | `rounded-sm` … `rounded-4xl`, all derived from `--radius`                    |
| Fonts    | `font-sans`, `font-mono`, `font-heading` (Geist, loaded in `app/layout.tsx`) |
| Sidebar  | `bg-sidebar`, `text-sidebar-foreground`, … — reserved for a sidebar shell    |

Never hardcode a hex or an arbitrary color (`bg-[#fafafa]`) for something a token covers.
If a token is genuinely missing, add it to `globals.css` in both palettes — don't work
around it in a component.

## Primitives

Build screens from `components/ui`. Add one with the CLI, never by hand-copying from a
website — the generator writes the Base UI flavour this project is on:

```bash
npx shadcn@latest add <name>
```

Generated files are project code: edit them when the design calls for it, but keep the
`data-slot` attributes and the `cva` variant shape so later `add` calls stay consistent.

If two features style the same thing the same way twice, it is a primitive. Put it in
`components/ui` rather than styling a one-off inline.

## Base UI, not Radix

- **Composition is `render`, not `asChild`.** A `Button` that navigates:
  ```tsx
  <Button render={<Link href="/example" />} nativeButton={false}>
    Example route
  </Button>
  ```
  `nativeButton={false}` tells Base UI the rendered element is not a `<button>`, so it
  wires focus and keyboard handling for an anchor instead.
- Props and part names follow Base UI's docs, not Radix's. When an example from the
  shadcn site doesn't typecheck, that is usually why — check the generated file in
  `components/ui` for the real signature.

## Styling

- Tailwind utilities in `className`. `cn()` for conditional classes, `cva()` for
  variants. Prettier sorts the class order — don't hand-order and don't fight the sort.
- No `style={{}}` for anything a utility covers. No `@apply` in CSS for component
  styling — `globals.css` uses it only for the base layer.
- Dark mode is the `.dark` class (`@custom-variant dark`). Tokens flip on their own;
  reach for a `dark:` variant only for something a token can't express.

## Icons

`lucide-react` is the icon set (`iconLibrary` in `components.json`). Import the glyph by
name; size it with the `size-*` utility, not a `size` prop with a magic number. shadcn
primitives already scale an `<svg>` child — a bare icon inside a `Button` needs no class.

```tsx
import { Search } from 'lucide-react';

<Button variant="outline">
  <Search />
  Search
</Button>;
```

An icon-only control takes an `aria-label`; don't encode meaning in the icon alone.

## JSX copy

Don't nest ternaries in JSX for user-facing text. Compute the string before render, or
use a lookup map keyed on the thing that varies. Full treatment with examples in
`docs/agents/code-style.md` §9.
