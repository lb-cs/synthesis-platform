# Synthesis Platform

An AI-assisted research workspace — CECS 491, Team Quintessential Algorithms — delivered
as a Next.js app.

This file is the domain glossary: the words this codebase uses, and the ones to avoid so
two people (or an agent and a person) don't describe the same thing differently. Read it
before naming anything new, and add to it the moment a concept gets a name in code.

## How to write an entry

One term per entry, in this shape:

```markdown
**Term**:
One or two sentences on what it is, where it lives in code (`lib/…`, a table, a type),
and the invariant that makes it that thing and not its neighbour.
_Avoid_: the synonyms people reach for that mean something subtly different here
```

Group entries under a heading per area. Keep each entry short — this file is read by
every agent before naming anything, so it is loaded often.

## Auth and identity

**User**:
Whoever is signed in. Lives in Supabase's `auth.users`; on the server it is read as
verified JWT **claims** via `supabase.auth.getClaims()` (`lib/supabase/server.ts`,
`proxy.ts`). There is no app-side users table yet — `claims.sub` is the id.
_Avoid_: "account", "member" (reserved for workspace membership later), "session" (that
is the cookie pair, not the person).

**One-time code**:
The 6-digit code Supabase emails to sign a user in. Signup and login are the same flow
(`app/login/actions.ts`); an unknown email gets a user. `app/login/schema.ts` is the
zod shape for both steps.
_Avoid_: "OTP" in user-facing copy, "magic link" (that is the link variant we turned off
in the email template), "password" (there are none).

**Public path**:
A route the guard lets a signed-out visitor reach. The list is `PUBLIC_PATHS` in
`lib/supabase/proxy.ts` (`/`, `/login`, `/api/health`); everything not on it is
**protected** and redirects to `/login`.
_Avoid_: "unprotected", "open route", "whitelist".

## Areas to expect

Sections that will almost certainly need entries as the product takes shape. Delete any
that turn out not to apply.

### Research content

What a user brings in and works on — the source material, the unit of work, how a
collection of them is named. Decide early whether the product word is "document",
"source", "paper", or something else, and stick to it.

### Synthesis

What the AI produces from research content, and how a produced thing is distinguished
from a user-authored one. Name the states a synthesis passes through (requested,
running, ready, failed) as a status union, and put the union here.

### Workspace and ownership

Who owns what — a workspace, a project, a member — and which words are reserved for
access control versus organisation.

### Data and transport

Once the app has a database and an API: the shape a row has versus the shape the client
receives, and the word for each. Keep the two words distinct from day one.
