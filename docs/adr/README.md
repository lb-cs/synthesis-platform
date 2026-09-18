# Architecture Decision Records

This directory holds the decisions that would otherwise get re-litigated or accidentally
undone. Read the ones that touch the area you're working in before you change it — an ADR
exists to stop you re-deriving a conclusion someone already paid for.

## When to write one

**Only when all three are true:**

1. **Hard to reverse** — undoing it later means a migration, a data backfill, or a
   rewrite of every call site
2. **Surprising without context** — a competent reader would look at the code and ask
   "why on earth is it like this?"
3. **A real trade-off** — there were genuine alternatives and one was picked for reasons
   worth keeping

If any one is missing, don't write an ADR. Most work needs none. A bug fix, a new route,
a refactor that keeps behaviour identical, or a choice you could reverse in an afternoon
are all "no".

**Things that would qualify here:** which test runner the repo standardises on; the
choice of database and how the app talks to it; whether data goes through route handlers
or server components query directly; the auth provider; where AI calls run and how their
output is stored; adding a logging path; a dependency the app would then be shaped
around.

## Format

Numbered `NNNN-kebab-title.md`, next number in sequence. The title is the decision **as a
statement**, not a topic — "Route handlers own all database access", not "Data access".

Body covers what was decided and why, a **Considered options** section naming what was
rejected and on what grounds, and a **Consequences** section for what this now costs or
obliges. Present tense, prose over bullets, and cite concrete evidence from this
codebase — file paths, table names, commits — rather than general principle.

```markdown
# 0001 — <the decision as a statement>

## Context

<the situation that forced a choice>

## Decision

<what we do, present tense>

## Considered options

<what was rejected, and on what grounds>

## Consequences

<what this now costs or obliges>
```

## Offer, don't assume

When a decision you're making looks like it qualifies, **say so and ask** before writing
the file. Then link it from the relevant `docs/rules/` file so it gets found from the code
side.
