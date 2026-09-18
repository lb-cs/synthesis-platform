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

## Research content

**Project**:
The unit a user organises research by — one topic, its sources, and its conversations.
Routes live under `app/(app)/projects/[projectId]/`. There is no table yet; the id in
the URL is a placeholder until CECS491-9 lands.
_Avoid_: "workspace" as a noun for the project itself (that is the screen, below),
"folder", "notebook".

**Workspace**:
The split-panel screen for one project — sources on one side, the AI chat on the other
(`app/(app)/projects/[projectId]/page.tsx`). A project has exactly one.
_Avoid_: "project page", "chat page".

**Source**:
Something a user adds to a project for the AI to draw on: an uploaded PDF or text file
today, a web link or YouTube video as a stretch goal. Listed under `…/sources`.
_Avoid_: "document" (reserved for the chunked text a source becomes), "file" (only one
kind of source), "paper".

## Shell

**Dashboard**:
The signed-in landing screen (`/dashboard`): the list of projects and the way to create
one. Named after the Jira wireframes; not a metrics dashboard.
_Avoid_: "home" (that is the signed-out `/`), "projects page".

**App shell**:
The sidebar-plus-header frame every signed-in screen renders inside —
`app/(app)/layout.tsx`, `components/app-sidebar.tsx`, `components/app-breadcrumb.tsx`.
Routes in the `(app)` group get it; `/` and `/login` do not.
_Avoid_: "nav", "chrome".

## Areas to expect

Sections that will almost certainly need entries as the product takes shape. Delete any
that turn out not to apply.

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
