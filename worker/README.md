# Worker

The Python service that processes uploaded sources (UC-15). It runs outside the Next.js
app: the app inserts a `sources` row with status `pending`, and the worker moves it to
`processing` and then `ready` or `failed` (with a `processing_error` the user sees).

Parsing, chunking, and embedding are separate stories. Today the worker downloads the
file and checks it isn't empty; those steps plug in to `src/worker/pipeline.py`.

## How it works

- **Polling.** Every few seconds the worker calls `claim_pending_sources()`, a Postgres
  function in `supabase/migrations/`. Why polling and not a webhook:
  [ADR 0001](../docs/adr/0001-worker-polls-for-pending-sources.md)
- **Safe claims.** The function uses `FOR UPDATE SKIP LOCKED`, so two workers never take
  the same source. Run as many worker processes as you like
- **Parallel.** Each process works on up to `WORKER_CONCURRENCY` sources at once in a
  thread pool
- **Crash recovery.** A source left in `processing` longer than
  `WORKER_STALE_AFTER_MINUTES` (the worker died mid-run) is marked `failed`
- **Service role.** The worker uses the secret key, which bypasses RLS. Only the
  `service_role` can run the queue functions

| File                     | Does                                                         |
| ------------------------ | ------------------------------------------------------------ |
| `src/worker/__main__.py` | Entry point: reads config, connects, handles Ctrl+C          |
| `src/worker/config.py`   | Environment variables and their defaults                     |
| `src/worker/db.py`       | Every query against `public.sources`                         |
| `src/worker/storage.py`  | Downloads files from the `sources` bucket                    |
| `src/worker/loop.py`     | Polling loop and thread pool; turns errors into `failed`     |
| `src/worker/pipeline.py` | The processing steps — where parse, chunk, and embed will go |

## Run it locally

You need the local database running (`npx supabase start` from the repo root, see
[local setup](../docs/local-setup.md)) and [uv](https://docs.astral.sh/uv/getting-started/installation/),
which installs the right Python for you.

```bash
cd worker
uv sync                    # creates .venv with the dependencies
cp .env.example .env       # then paste the secret key from `npx supabase status`
uv run python -m worker
```

Upload a file in the app and watch its status change on the sources page. Stop the
worker with Ctrl+C; it finishes the sources it already started before exiting.

## Checks

CI runs the first three on every pull request.

```bash
uv run ruff check          # lint
uv run ruff format --check # formatting (ruff format to fix)
uv run pytest              # unit tests; integration tests skip without a database
```

`tests/test_claim_sql.py` runs the claim functions against the real local database —
eight concurrent claimers, checking none get the same row. It runs when `supabase start`
is up and skips otherwise. It rolls back its claims and deletes the test user it creates.
