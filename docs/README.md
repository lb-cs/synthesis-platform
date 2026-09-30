# Documentation

Everything written down about Synthesis Platform, for people and AI agents alike. Plain
markdown, no tool-specific format.

## Where to start

| You want to…                               | Read                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| Understand what we're building and why     | [product/README.md](product/README.md)                                           |
| Know exactly what a feature must do        | [product/use-cases.md](product/use-cases.md)                                     |
| Check a speed, security, or quality target | [product/non-functional-requirements.md](product/non-functional-requirements.md) |
| See the full requirement list              | [product/requirements.md](product/requirements.md)                               |
| See how the app is built, and what's built | [design/architecture.md](design/architecture.md)                                 |
| See the tables and their rules             | [design/data-model.md](design/data-model.md)                                     |
| Know what changed from the original spec   | [product/spec-vs-build.md](product/spec-vs-build.md)                             |
| Write code that fits the repo              | [rules/README.md](rules/README.md), [agents/code-style.md](agents/code-style.md) |
| Record or read an architecture decision    | [adr/README.md](adr/README.md)                                                   |

## Layout

```
docs/
  README.md                 This file — the map
  product/                  What the product must do (from the team's spec documents)
    README.md               Overview: purpose, users, core principle, team, timeline
    requirements.md         RFP + SRS requirements: features, constraints, interfaces
    use-cases.md            All 20 use cases, UC-01 … UC-20
    non-functional-requirements.md   Speed, accuracy, and trust targets
    spec-vs-build.md        What changed from the original spec, and why
  design/                   How we build it on Next.js + Supabase
    architecture.md         Who handles what, screens → routes, request flows
    data-model.md           Tables, RLS rules, what the spec's entities became
  rules/                    How to write code here (tool-agnostic dev rules)
  agents/                   Deep code-style reference
  adr/                      Architecture decision records
```

`CONTEXT.md` at the repo root is the domain glossary — the words the **code** uses.

## Which source wins

The product and design docs started as the team's spring 2026 spec and are **adapted to
our stack** — Next.js front and back, Supabase for auth, data, and files. Where the spec
asked for something Supabase or Next.js already does (auth controllers, session tables,
a job queue), the docs say so instead of describing it.

When they still disagree with the code:

1. **The code, `supabase/migrations/`, and `CONTEXT.md`** say what is true today
2. **The docs here** say what the finished product should do. Fix whichever is wrong, in
   the same PR
3. **[spec-vs-build.md](product/spec-vs-build.md)** records deliberate departures from
   the original spec. Don't undo one without checking with the team

## Keeping these current

- A use case, requirement, or entity changes → edit the doc here, in the same PR
- A feature ships → update its status in [architecture.md](design/architecture.md)
- A migration changes a table → update [data-model.md](design/data-model.md)
- A decision departs from the original spec → add a row to
  [spec-vs-build.md](product/spec-vs-build.md)
- A new domain word lands in code → add it to `CONTEXT.md`
- Prettier formats these files. Run `npm run format` rather than aligning tables by hand
