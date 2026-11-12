# Data model

The data the app stores, as built in `supabase/migrations/`. The migration is the source
of truth. This page explains it and records what the spec asked for on top. For how
requests reach this data, see [architecture.md](architecture.md). For the words, see
`CONTEXT.md`.

## Overview

| Table                    | Holds                                                    | Written by                |
| ------------------------ | -------------------------------------------------------- | ------------------------- |
| `auth.users`             | Everyone who has signed in. Owned by Supabase Auth       | Supabase                  |
| `public.projects`        | A user's research projects                               | The user                  |
| `public.sources`         | Uploaded files in a project, and their processing status | User adds; worker updates |
| `public.document_chunks` | Passages of a source's text, with embeddings             | Worker only               |
| `public.chat_messages`   | The project's single conversation                        | The user (via the app)    |
| `public.citations`       | Links from an answer to the chunks behind it             | The user (via the app)    |
| Storage bucket `sources` | The uploaded files themselves                            | The user                  |

"The user" means the app, running queries as the signed-in user, so RLS applies. The
worker uses the service role and bypasses RLS.

```mermaid
erDiagram
  users ||--o{ projects : owns
  projects ||--o{ sources : contains
  projects ||--o{ chat_messages : "one conversation"
  sources ||--o{ document_chunks : "split into"
  chat_messages ||--o{ citations : cites
  document_chunks ||--o{ citations : "cited by"
```

## The rules the schema enforces

- **One owner.** Every row hangs off a project, and a project off one user. RLS on every
  table limits reads and writes to your own projects. Another user's row reads as "not
  found"
- **Citations can't cross users.** A citation insert must name your own message **and**
  your own chunk
- **Deletes cascade.** User → projects → sources → chunks → citations, and project →
  messages → citations. Deleting a source removes it from every answer
- **Storage does not cascade.** Deleting a row leaves its file in the bucket. The app
  must delete the file through the Storage API
- **Users can't fake processing.** Users can insert a source (`project_id`, `kind`,
  `title`, and `storage_path` for a file or `url` for a link) and rename it. Only the worker sets `processing_error`,
  `metadata`, and writes chunks. A narrow `retry_failed_source()` function lets the owner
  move a failed source back to `pending`, and `reprocess_ready_source()` does the same for a ready one

## Tables

### Users — `auth.users`

Supabase's table. No app-side users table yet; `claims.sub` from `getClaims()` is the
user id. Supabase handles sign-in codes, sessions, tokens, email change, and a Google
provider when we turn it on.

### `projects`

| Column        | Type        | Notes                                             |
| ------------- | ----------- | ------------------------------------------------- |
| `id`          | uuid        |                                                   |
| `user_id`     | uuid        | Defaults to `auth.uid()` — the app never sends it |
| `title`       | text        | 1–100 characters after trimming                   |
| `description` | text, null  | Blank is stored as `null`, never `''`             |
| `created_at`  | timestamptz |                                                   |
| `updated_at`  | timestamptz | Set by a trigger on every update                  |

Code: `lib/projects.ts` (list, get, create, update, delete). API: `/api/projects`,
`/api/projects/[projectId]`.

### `sources`

| Column                  | Type              | Notes                                                                                                                     |
| ----------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `id`                    | uuid              |                                                                                                                           |
| `project_id`            | uuid              |                                                                                                                           |
| `kind`                  | text              | `pdf` \| `text` \| `link`. YouTube is a stretch goal                                                                      |
| `title`                 | text              | 1–200 characters. The only column a user can change                                                                       |
| `storage_path`          | text, null        | `{user_id}/{project_id}/{file}` in the `sources` bucket. Unique. Null for a link                                          |
| `url`                   | text, null        | A link's `http(s)` address, up to 2,048 characters. Null for a file. A source has a `storage_path` or a `url`, never both |
| `status`                | text              | `pending` → `processing` → `ready` \| `failed`. The worker's queue                                                        |
| `processing_error`      | text, null        | Why it failed                                                                                                             |
| `processing_started_at` | timestamptz, null | When the worker claimed it. A stale value means the worker died                                                           |
| `metadata`              | jsonb             | Whatever the parser finds: author, page count, …, plus the worker's short `summary`. Chat lists it in every prompt        |
| `created_at`            | timestamptz       |                                                                                                                           |

The bucket accepts PDF, plain text, and Markdown up to 50 MiB.

The worker reads the queue through two functions only `service_role` can run:
`claim_pending_sources(max_count)` takes the oldest `pending` rows with `SKIP LOCKED` and
sets them `processing`; `fail_stale_sources(minutes)` fails rows stuck in `processing`.
A signed-in owner can retry a failed source through `retry_failed_source()`; the worker
picks it up on its next poll. See [ADR 0001](../adr/0001-worker-polls-for-pending-sources.md).

### `document_chunks`

| Column        | Type          | Notes                                                                                   |
| ------------- | ------------- | --------------------------------------------------------------------------------------- |
| `id`          | uuid          |                                                                                         |
| `source_id`   | uuid          |                                                                                         |
| `project_id`  | uuid          | Copied from the source so search needs no join. Kept in sync by a composite foreign key |
| `chunk_index` | integer       | Order within the source. Unique per source                                              |
| `content`     | text          |                                                                                         |
| `page_number` | integer, null | For citations                                                                           |
| `embedding`   | vector(1536)  | OpenAI `text-embedding-3-small`. Null until embedded                                    |
| `created_at`  | timestamptz   |                                                                                         |

Search: `match_document_chunks(project_id, query_embedding, match_count = 8)` returns the
nearest chunks in one project with a `similarity` score. It runs as the caller, so RLS
applies. The query must be embedded with the same model. Only `ready` sources are
searched: the worker writes chunks before it marks a source ready, so a source that
failed part-way can still have some.

`match_source_chunks(project_id, source_ids, query_embedding, match_count_per_source = 6)`
returns the best few chunks from each chosen source instead, so a long source can't
crowd a short one out of a comparison. Same rules: runs as the caller, `ready` only.

`sample_source_chunks(project_id, chunks_per_source = 8)` takes up to N chunks spread
evenly through each ready source in the project, in reading order. Themes has no query
to embed, so it samples instead of searching. Same rules: runs as the caller.

### `chat_messages`

| Column       | Type        | Notes                                                     |
| ------------ | ----------- | --------------------------------------------------------- |
| `id`         | uuid        |                                                           |
| `project_id` | uuid        | One running conversation per project. New chat deletes it |
| `role`       | text        | `user` \| `assistant`                                     |
| `content`    | text        |                                                           |
| `status`     | text        | `streaming` \| `complete` \| `failed`. Default `complete` |
| `created_at` | timestamptz |                                                           |

### `citations`

| Column        | Type        | Notes                                              |
| ------------- | ----------- | -------------------------------------------------- |
| `id`          | uuid        |                                                    |
| `message_id`  | uuid        | The assistant message                              |
| `chunk_id`    | uuid        | The supporting chunk. It gives the source and page |
| `number`      | integer     | The `[n]` the answer used. Unique per message      |
| `anchor_text` | text, null  | The quoted passage, when the model quotes one      |
| `created_at`  | timestamptz |                                                    |

## Spec operations → how they happen

The spec listed methods on each entity. Most are one Supabase call; none needs its own
class.

| Spec method                                   | Here                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------- |
| `CreateAccount`, `Login`, `CreateSession`     | `signInWithOtp` + `verifyOtp` — first sign-in creates the user       |
| `ValidateSession`                             | `getClaims()` — verifies the JWT                                     |
| `TerminateSession`                            | `signOut()`                                                          |
| `UpdateAccount`                               | `updateUser({ email })` + `verifyOtp` with the code sent to it       |
| `RequestAccountDeletion`                      | `auth.admin.deleteUser` (service role) — the database cascades       |
| `CreateProject` … `DeleteProject`             | `lib/projects.ts`                                                    |
| `AddUploadedSource`                           | Storage upload, then insert a `sources` row                          |
| `UpdateSourceStatus`                          | Worker updates `status`                                              |
| `RemoveSource`                                | Delete the row (chunks and citations cascade), then the file         |
| `CreateMetadata`, `ExtractMetadata`           | Worker fills `sources.metadata`                                      |
| `CreateChunk`, `IndexChunk`                   | Worker inserts chunks with embeddings; the HNSW index updates itself |
| `CreateUserMessage`, `CreateAssistantMessage` | Insert `chat_messages`                                               |
| `CreateCitation`, `AttachCitations`           | Insert `citations`                                                   |
| `ValidateCitation`                            | Not needed — a deleted source deletes its citations                  |
| `ResolveCitationTarget`                       | Join citation → chunk → source for the file and page                 |

## Not stored, on purpose

Spec entities with no table, and why.

| Spec entity            | Why there's no table                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| Session, OAuthToken    | Supabase Auth owns sessions and provider tokens                                                                |
| AccountDeletionRequest | Deletion is immediate: delete the auth user and everything cascades. No approval step, so no admin role needed |
| ProcessingJob          | `sources.status` is the queue                                                                                  |
| SourceMetadata         | A `jsonb` column on `sources`, not its own table                                                               |
| Notification           | No use case needs it                                                                                           |

`Project.status` / `ArchiveProject` from the spec was also left out — no use case asks
for archiving.

## Stretch goals

Planned for their own migration later. What the spec asked for:

| Entity           | Spec attributes                                                    | Rules from the spec                                            |
| ---------------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| Summary          | project, source ids, summary type, content, created date           | Sources must be in the project and `ready`. Cites key passages |
| ComparisonResult | project, source ids, topic, content, created date                  | **At least two** sources. Every claim cited                    |
| Insight          | project, title, description, supporting source ids, type, priority | At least two sources. Every theme lists its evidence           |

Open question: today a citation belongs to a chat message. Summaries, comparisons, and
insights need citations too — either a nullable link per output type, or one shared
"output" table. Comparisons (UC-18) dodge it for now: they are not saved, so their
citations live only in the streamed response. Decide when summaries or insights need to
be stored.

## Still open from the spec

- **YouTube sources** need a `kind` value, and a location that isn't a page (the spec's
  `timestampRange`). Web links are built (`kind = 'link'`, `url`): the worker fetches
  them into chunks (CECS491-85), with the page title in `metadata.title`, and their
  citations open the page by `url` instead of `…/sources/[sourceId]/file`
- **"Typical" and "moderate-size"** — the spec never gives numbers
