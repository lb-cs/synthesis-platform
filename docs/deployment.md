# Deployment

What runs where, and how to ship the Python worker. The worker is the one piece that
can't go on Vercel; everything else is hosted already.

| Piece                   | Runs on                                                          | Ships when                                                      |
| ----------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| Next.js app             | Vercel                                                           | Vercel's Git integration deploys `main`                         |
| Database, Auth, Storage | Supabase (hosted project)                                        | Migrations: `npx supabase db push` from a linked checkout       |
| Worker (`worker/`)      | A container host. Railway recommended, see [below](#pick-a-host) | The host deploys `main` once it is connected to the GitHub repo |

Without a running worker, every upload stays `pending` forever: nothing else parses or
chunks sources.

## Why not Vercel

- **The worker is a long-running process.** It polls every 5 seconds, keeps a thread pool,
  and finishes its work when it gets SIGTERM. Vercel runs functions per request or per
  schedule, then stops them
- **The only way to run it on a timer is a cron job.** On Hobby, crons run once a day. On
  Pro, once a minute at best. That is up to 60 s before a source is picked up, against
  UC-15's 30 s target. And the worker would need rewriting as a function that drains
  the queue on each call
- **Vercel Queues could replace polling.** But that replaces
  [ADR 0001](adr/0001-worker-polls-for-pending-sources.md) (the database is the queue)
  for no gain at our size

## Pick a host

Any host that runs a Docker container works. `worker/Dockerfile` is portable.

| Host                      | Why                                                                                                           | Cost (check before you sign up) |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **Railway** (recommended) | Deploys a monorepo folder from GitHub, builds the Dockerfile, no port needed. Billed by use, so idle is cheap | Hobby: $5/month incl. $5 usage  |
| Render                    | Has a "Background Worker" service type made for this                                                          | Starter: $7/month flat          |
| Fly.io, Cloud Run, a VPS  | Fine too. More setup                                                                                          | Varies                          |

What the worker needs from any host:

- Builds `worker/Dockerfile` with `worker/` as the build context
- **No inbound traffic.** No port, no public domain, no HTTP health check
- Outbound HTTPS to Supabase (and to the embedding API once CECS491-70 lands)
- Restart on crash
- One instance is enough. More are safe: `claim_pending_sources()` uses `SKIP LOCKED`

## Before the first deploy

1. **Apply every migration** in `supabase/migrations/` to the hosted project. On start,
   the worker calls `fail_stale_sources()` and exits if it isn't there

   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

2. **Collect two values.** Both already exist in the Vercel project's environment
   variables:
   - `SUPABASE_URL`: the hosted project URL, same as `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`: the secret key, same value the app uses for account
     deletion. It bypasses RLS: paste it into the host's secret variables only

## Deploy on Railway

Railway builds the branch the service is connected to, `main` unless you change it under
**Settings → Source**. `worker/Dockerfile` must be on that branch. Without it Railway
guesses how to build the worker and fails (see [Troubleshooting](#troubleshooting)).

1. **New Project → Deploy from GitHub repo** → `lb-cs/synthesis-platform`
2. **Service → Settings → Source → Root Directory:** `/worker`. Railway then finds
   `worker/Dockerfile` and builds it
3. **Settings → Watch Paths:** `/worker/**`, so commits that only touch the app don't
   redeploy the worker
4. **Variables:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
   `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=60`. The last one is how long Railway waits
   between SIGTERM and SIGKILL on a redeploy. Its default is 0, which kills the worker
   before it can finish the sources it started. Optional: `WORKER_CONCURRENCY`,
   `WORKER_POLL_INTERVAL_SECONDS`, `WORKER_STALE_AFTER_MINUTES` (see
   `worker/.env.example`)
5. **Don't generate a domain.** The worker serves nothing
6. **Deploy, then check the logs** for `worker started: concurrency=4, poll every 5s`.
   Upload a file in the production app. It should go `pending → processing → ready`
   within about 10 seconds

On Render instead: **New → Background Worker** → the repo → Language **Docker**, Root
Directory `worker` → instance **Starter** → the same two variables → Create.

## Run the image locally

To check the image before a host builds it:

```bash
docker build -t synthesis-worker worker
docker run --rm --env-file worker/.env --network host synthesis-worker
```

`--network host` lets the container reach `supabase start` on `127.0.0.1`. That works on
Linux. On Docker Desktop, set `SUPABASE_URL=http://host.docker.internal:54321` instead.

## Living with it

- **Merging to `main` deploys the worker.** A PR that adds a migration the worker needs
  must have that migration applied before it merges, or the new worker exits at start
- **Redeploys are graceful.** On SIGTERM the worker stops claiming and finishes the
  sources it started. If the host kills it first, those sources stay `processing` until
  the stale sweep fails them (`WORKER_STALE_AFTER_MINUTES`, default 15). The user then
  retries
- **Logs are the only output.** Look for `failed`, `could not`, and stack traces
- **More throughput:** raise `WORKER_CONCURRENCY`, or add instances

## When embedding lands (CECS491-70)

- **The worker must embed with the app's model.** That is `openai/text-embedding-3-small`
  (1536 dimensions) in `lib/ai.ts`, or questions and chunks won't match. AI Gateway serves
  it through an OpenAI-compatible API (`https://ai-gateway.vercel.sh/v1`). So the worker
  can use the same gateway with its own `AI_GATEWAY_API_KEY`. Off Vercel there is no
  OIDC token, so it needs a key
- Add that key to the host's variables
- Recheck `WORKER_STALE_AFTER_MINUTES` against a large PDF, as ADR 0001 says

## Troubleshooting

| Symptom                                                 | Cause                                                                                                                                                                                                          |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exits at start: `could not reach Supabase at …`         | Wrong URL or key, or migrations not applied. The stack trace under it names the missing function if it's the latter                                                                                            |
| Exits at start: `SUPABASE_URL and … must be set`        | A variable is missing on the host                                                                                                                                                                              |
| Sources stay `pending`                                  | The worker isn't running, or it points at a different Supabase project than the app                                                                                                                            |
| Railway build: `Railpack` … `No start command detected` | Railway found no `Dockerfile` and fell back to Railpack. The branch it builds doesn't have `worker/Dockerfile` yet (merge it, or switch the branch under Settings → Source), or Root Directory isn't `/worker` |
| Railway build: `Cache mount ID is not prefixed with …`  | Someone added a `--mount=type=cache` to the Dockerfile. Railway needs its service id in it. Remove the mount                                                                                                   |
