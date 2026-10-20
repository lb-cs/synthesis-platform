# 0001 — The worker polls Postgres and claims sources with SKIP LOCKED

## Context

Uploading a source inserts a `public.sources` row with status `pending`
(`lib/sources.ts`). The Python worker in `worker/` has to find those rows, and there is
no job table: `sources.status` is the queue (`pending → processing → ready | failed`).
UC-15 asks for a status update within 30 seconds for a moderate file, several sources in
parallel, and a web app that never waits on processing. Two workers — or two threads in
one — must never take the same row. Whatever we pick has to run the same way against
`supabase start` on a laptop and against the hosted project.

## Decision

The worker polls. Every `WORKER_POLL_INTERVAL_SECONDS` (default 5) it calls
`claim_pending_sources(max_count)`, a Postgres function from
`supabase/migrations/20261020120000_worker_claim.sql`. In one statement it selects the
oldest pending rows `FOR UPDATE SKIP LOCKED`, sets them to `processing` with
`processing_started_at = now()`, and returns them. A row another worker is claiming is
skipped rather than waited on, so concurrent claims never overlap. The worker asks for
at most as many rows as it has free threads, so a full worker leaves the rest for others.

A source whose worker dies stays `processing`. Once a minute the worker calls
`fail_stale_sources(WORKER_STALE_AFTER_MINUTES)` (default 15), which marks those rows
`failed` with a message the user sees — UC-15's "processing times out" error. A worker
only finishes a row that is still `processing`, so a late result never overwrites one.

Both functions are executable by `service_role` only.

## Considered options

**Database webhook** (Supabase Database Webhooks, `pg_net` posting to the worker on
insert). Lower latency, but the worker would have to expose an HTTP endpoint the
database can reach — awkward from the Docker database to a laptop, and a public URL in
production. `pg_net` is fire-and-forget: a request sent while the worker is down is lost,
so we would still need a polling sweep for missed rows. That is two mechanisms where one
covers it.

**Realtime or `LISTEN/NOTIFY`.** Same latency gain, same missed-while-down problem, plus a
long-lived connection to keep alive. Either can be added later as a wake-up signal on top
of polling without changing the claim.

**Claim from Python with select-then-update.** Two round trips with a race between them;
PostgREST cannot express `SKIP LOCKED`, so the claim has to live in a function anyway.

**Reset stale rows to `pending` instead of failing them.** Retries for free, but a file
that crashes the worker would loop forever. Re-uploading is the retry for now.

## Consequences

- A new source waits up to one poll interval before it is picked up. At 5 s that is well
  inside the 30 s target; lower `WORKER_POLL_INTERVAL_SECONDS` if it matters
- An idle worker makes one cheap query per interval. The partial index
  `sources_pending_created_at_idx` keeps it cheap however many rows are done
- Scaling is running more worker processes; nothing else changes
- `WORKER_STALE_AFTER_MINUTES` must stay above the longest real processing time. When
  embedding lands, check it against a large PDF
- The worker logs to stdout with Python's `logging`. It has no UI, so this is its only
  way to report problems; it is not a logging path for the web app
