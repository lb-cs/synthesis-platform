# Deployment

What runs where, and how the Python worker is set up on Railway.

| Piece                   | Runs on                                 | Ships when                                                |
| ----------------------- | --------------------------------------- | --------------------------------------------------------- |
| Next.js app             | Vercel                                  | Vercel deploys `main`                                     |
| Database, Auth, Storage | Supabase (hosted project)               | Migrations: `npx supabase db push` from a linked checkout |
| Worker (`worker/`)      | Railway, built from `worker/Dockerfile` | Railway deploys `main` when `worker/**` changes           |

Without a running worker, every upload stays `pending`: nothing else parses or chunks
sources.

## Why the worker isn't on Vercel

It is a long-running process: it polls every 5 seconds, keeps a thread pool, and finishes
its work when it gets SIGTERM. Vercel runs functions per request or on a cron job, at
best once a minute. That would mean rewriting the worker as a function and missing
UC-15's 30-second target. Railway runs the Dockerfile as an always-on service with no
port or domain.

## Railway service

| Setting                   | Value                              | Why                                                      |
| ------------------------- | ---------------------------------- | -------------------------------------------------------- |
| Source                    | `lb-cs/synthesis-platform`, `main` | Railway builds the branch it is connected to             |
| Settings → Root Directory | `/worker`                          | Railway builds only this folder and finds the Dockerfile |
| Settings → Watch Paths    | `/worker/**`                       | Commits that only touch the app don't redeploy it        |
| Domain                    | None                               | The worker serves nothing                                |

| Variable                              | Value                                                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`                        | The hosted project URL, same as `NEXT_PUBLIC_SUPABASE_URL` in Vercel                                                 |
| `SUPABASE_SERVICE_ROLE_KEY`           | The secret key, same as in Vercel. It bypasses RLS: it lives only in Railway and Vercel                              |
| `OPENAI_API_KEY`                      | OpenAI secret key used by the worker for embeddings. Keep it in Railway only; never expose it in the browser         |
| `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` | `60`: time between SIGTERM and SIGKILL on a redeploy. Railway's default is 0, which kills the worker mid-file        |
| `WORKER_CONCURRENCY`, …               | Optional. `WORKER_POLL_INTERVAL_SECONDS` and `WORKER_STALE_AFTER_MINUTES` too; defaults are in `worker/.env.example` |

### Setting it up from scratch

1. **Apply every migration** in `supabase/migrations/` to the hosted project. On start, the
   worker calls `fail_stale_sources()` and exits if it isn't there

   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

2. **New Project → Deploy from GitHub repo** → `lb-cs/synthesis-platform`
3. Set the settings and variables above
4. **Check the deploy logs** for `worker started: concurrency=4, poll every 5s`, then upload
   a file in the production app. It goes `pending → processing → ready` in about 10
   seconds

## Shipping changes

- **Merging to `main` deploys the worker** when `worker/**` changed. If the new code needs
  a migration, apply it to the hosted project before merging, or the new worker exits at
  start
- **Redeploys are graceful.** On SIGTERM the worker stops claiming and finishes the
  sources it started. If Railway kills it first, those sources stay `processing` until the
  stale sweep fails them (`WORKER_STALE_AFTER_MINUTES`, default 15). The user then retries
- **Logs are the only output.** Look for `failed`, `could not`, and stack traces
- **More throughput:** raise `WORKER_CONCURRENCY`, or add replicas. Two workers never take
  the same source: `claim_pending_sources()` uses `SKIP LOCKED`

## Checking the image locally

With `supabase start` running and `worker/.env` filled in:

```bash
docker build -t synthesis-worker worker
docker run --rm --env-file worker/.env -e SUPABASE_URL=http://host.docker.internal:54321 synthesis-worker
```

`host.docker.internal` is how a container on Docker Desktop reaches your machine's
`127.0.0.1`.

## Embedding (CECS491-70)

- The worker must embed with the app's model, `openai/text-embedding-3-small` (1536
  dimensions) in `lib/ai.ts`, or questions and chunks won't match. AI Gateway serves it
  through an OpenAI-compatible API (`https://ai-gateway.vercel.sh/v1`)
- Railway has no Vercel OIDC token, so add an `AI_GATEWAY_API_KEY` to its variables
- Recheck `WORKER_STALE_AFTER_MINUTES` against a large PDF, as ADR 0001 says

## Troubleshooting

| Symptom                                                 | Cause                                                                                                                            |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Exits at start: `could not reach Supabase at …`         | Wrong URL or key, or migrations not applied. The stack trace under it names the missing function if it's the latter              |
| Exits at start: `SUPABASE_URL and … must be set`        | A variable is missing in Railway                                                                                                 |
| Sources stay `pending`                                  | The worker isn't running, or it points at a different Supabase project than the app                                              |
| Railway build: `Railpack` … `No start command detected` | Railway found no `Dockerfile`, so it guessed. The branch it builds has no `worker/Dockerfile`, or Root Directory isn't `/worker` |
| Railway build: `Cache mount ID is not prefixed with …`  | Someone added a `--mount=type=cache` to the Dockerfile. Railway needs its service id in it. Remove the mount                     |
