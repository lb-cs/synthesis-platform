# Worker

TEST DEPLOYMENT

The Python service that processes uploaded sources (UC-15). It runs outside the Next.js
app: the app inserts a `sources` row with status `pending`, and the worker moves it to
`processing` and then `ready` or `failed` (with a `processing_error` the user sees).

Today the worker downloads the file, parses it into pages, splits the pages into
chunks, and saves the chunks and the file's details (see
[Parsing and chunking](#parsing-and-chunking)). The worker embeds every chunk with OpenAI
`text-embedding-3-small` before saving it. Chunks are saved before the source is marked
`ready`, so retrieval only sees complete sources.

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

| File                       | Does                                                     |
| -------------------------- | -------------------------------------------------------- |
| `src/worker/__main__.py`   | Entry point: reads config, connects, handles Ctrl+C      |
| `src/worker/config.py`     | Environment variables and their defaults                 |
| `src/worker/db.py`         | Every query against `public.sources`                     |
| `src/worker/storage.py`    | Downloads files from the `sources` bucket                |
| `src/worker/loop.py`       | Polling loop and thread pool; turns errors into `failed` |
| `src/worker/pipeline.py`   | Parses, chunks, and embeds each source                   |
| `src/worker/embeddings.py` | OpenAI embedding requests and response validation        |

## Parsing and chunking

`src/worker/parsing.py` turns a file into text, one entry per page. PDFs are read with
PyMuPDF, the library picked in the
[PDF extraction spike](../docs/research/pdf-extraction-spike.md). Plain text has no
pages, so it is one entry with no page number. Page numbers start at 1, matching what a
reader sees. A blank page keeps its number, so later pages stay correct.

PDF text is read block by block (a block is PyMuPDF's paragraph). Each paragraph is
unwrapped onto one line, with a blank line between paragraphs. PDFs end every visual line
with a newline, so without this every cut would land on a line wrap, often mid-sentence.

`src/worker/chunking.py` splits each page into chunks. A chunk never crosses a page, so
every chunk's `page_number` is exact and a citation can open the right page.

| Setting         | Value            | Why                                                                                                                                               |
| --------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CHUNK_SIZE`    | 1,000 characters | About 250 tokens: big enough to hold a complete idea, small enough that a search returns a focused passage and several fit in the model's context |
| `CHUNK_OVERLAP` | 200 characters   | A sentence cut at a boundary still appears whole in one of the two chunks. Kept under half the size so the split always moves forward             |

Cuts prefer a paragraph break, then a line break, then a sentence end, then any space,
and only in the back half of the window so a chunk is never tiny. A short page is one
small chunk rather than being merged into its neighbour, because merging would make the
page number wrong.

A file the worker can't read fails with a message the user sees in `processing_error`:
damaged or password-protected PDFs, PDFs with no text layer (scans made of images; OCR is
a separate requirement), text that isn't UTF-8, and binary files with a text extension.

## Run it locally

You need the local database running (`npx supabase start` from the repo root, see
[local setup](../docs/local-setup.md)) and [uv](https://docs.astral.sh/uv/getting-started/installation/),
which installs the right Python for you.

```bash
cd worker
uv sync                    # creates .venv with the dependencies
cp .env.example .env       # fill in Supabase keys and OPENAI_API_KEY
uv run python -m worker
```

Upload a file in the app and watch its status change on the sources page. Stop the
worker with Ctrl+C; it finishes the sources it already started before exiting.
The OpenAI key is read only by this worker and must not be committed or exposed to the
browser.

Once `.env` is set up, `npm run dev:all` from the repo root runs Supabase, the worker,
and the app in one terminal (`scripts/dev.sh`).

## Deploy it

It runs on Railway, built from the `Dockerfile` here. Setup:
[deployment](../docs/deployment.md).

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
`tests/test_match_sql.py` checks the same way that chat search skips sources that are not
`ready`.
