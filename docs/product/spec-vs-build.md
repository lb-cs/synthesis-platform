# Spec vs build

What changed between the team's original spec documents (spring 2026) and what we
actually build — and why. The rest of `docs/product/` and `docs/design/` is already
updated to match; this page is the record of **what** was changed, so nobody "fixes" the
code back to the old spec.

_Last checked against the code: 2026-09-29 (`main` at `1cdc16c`)._ Update this page when
a decision changes.

## Big decisions

| Topic               | Original spec                                               | We build                                                                                                                                         |
| ------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend             | Node.js or Python server with controller objects            | **Next.js** route handlers and server actions over plain `lib/` functions. No controller classes — see [architecture](../design/architecture.md) |
| Sign-in             | Email + password (UC-01, UC-03), plus Google OAuth2 (UC-02) | **Passwordless emailed code** via Supabase Auth. Signup and login are one flow. No passwords exist. Google comes later, through Supabase         |
| Sessions and tokens | App-managed `Session` and `OAuthToken` entities             | **Supabase Auth** owns them. Server code reads verified JWT claims with `getClaims()`                                                            |
| Users               | App `User` table                                            | Supabase `auth.users`. `claims.sub` is the user id                                                                                               |
| Access control      | A `SecurityController`                                      | **Row-level security** on every table and the storage bucket, plus the route guard in `proxy.ts`                                                 |
| Database            | PostgreSQL or MongoDB                                       | **Supabase Postgres**                                                                                                                            |
| Vector index        | Pinecone or Weaviate                                        | **pgvector** in the same database — `match_document_chunks()`                                                                                    |
| File storage        | AWS S3 or equivalent                                        | **Supabase Storage**, private bucket `sources`, 50 MiB, PDF / text / Markdown                                                                    |
| Processing jobs     | `ProcessingJob` entity with its own states                  | **No job table.** `sources.status` is the queue. A separate **Python worker** does the work                                                      |
| Account deletion    | `AccountDeletionRequest` with an approval step              | Immediate: delete the auth user and the database cascades. The app deletes Storage files                                                         |
| Notifications       | `Notification` entity                                       | Dropped — no use case needs it                                                                                                                   |
| Embeddings          | —                                                           | OpenAI `text-embedding-3-small`                                                                                                                  |
| LLM provider        | OpenAI or Anthropic                                         | Not chosen yet                                                                                                                                   |
| API versioning      | `/api/v1/…` (SRS §6.5)                                      | Unversioned: `/api/projects`                                                                                                                     |
| Stretch goals       | Everything in the RFP                                       | Links (UC-12), summaries (UC-17, `CECS491-15`), analysis (UC-18, UC-19, `CECS491-16`)                                                            |

## By use case

| Use case               | Status in code                                                                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UC-01 Create account   | Built as emailed-code sign-in (`/login`). The spec's password rules, password errors, and NFR-02 were dropped                                                                    |
| UC-02 Google           | Not built. Needs a button and one callback route; Supabase does the rest                                                                                                         |
| UC-03 Log in           | Same flow as UC-01                                                                                                                                                               |
| UC-04 Log out          | `signOut` server action exists (`app/login/actions.ts`)                                                                                                                          |
| UC-05 Edit account     | `/settings` page exists. Email change (Supabase `updateUser`) not wired                                                                                                          |
| UC-06 Delete account   | Database side ready: deleting the auth user cascades. No UI flow, no Storage cleanup yet                                                                                         |
| UC-07 – UC-10 Projects | REST API built: `GET`/`POST /api/projects`, `GET`/`PATCH`/`DELETE /api/projects/[projectId]`. `/projects/new` form exists. Title 1–100 chars; blank description stored as `null` |
| UC-11 Upload           | Schema and storage bucket ready; no upload UI yet. Kinds are `pdf` and `text` — Markdown and transcripts are `text`                                                              |
| UC-12 Links            | **Stretch goal.** `sources.kind` doesn't allow links yet                                                                                                                         |
| UC-13 View sources     | `/projects/[projectId]/sources` route exists                                                                                                                                     |
| UC-14 Remove source    | Schema ready — deleting a source cascades to its chunks and their citations                                                                                                      |
| UC-15 Processing       | Schema ready (status, `processing_error`, chunks with page numbers). Python worker not built (CECS491-11/12)                                                                     |
| UC-16 Q&A              | Schema ready: `chat_messages` (one conversation per project), `citations`, `match_document_chunks()`                                                                             |
| UC-17 Summaries        | **Stretch goal** (Jira `CECS491-15`). Placeholder page at `/projects/[projectId]/summaries`                                                                                      |
| UC-18, UC-19 Analysis  | **Stretch goal** (Jira `CECS491-16`). Placeholder page at `/projects/[projectId]/analysis`                                                                                       |
| UC-20 Citations        | Schema ready. A citation points at a chunk; the chunk gives source and page                                                                                                      |

For the spec's entities mapped to tables, see
[data-model.md](../design/data-model.md#not-stored-on-purpose). For screens mapped to
routes, see [architecture.md](../design/architecture.md#screens-and-routes).

## Words: spec → code

The spec and the code sometimes use the same word differently. In code, use the
`CONTEXT.md` term.

| Spec says                        | Code says                                                        | Why it matters                              |
| -------------------------------- | ---------------------------------------------------------------- | ------------------------------------------- |
| Project / workspace (same thing) | **Project** is the data; **workspace** is its split-panel screen | Don't name a table or type "workspace"      |
| Processed                        | `ready`                                                          | The status value                            |
| senderType                       | `role`                                                           |                                             |
| sourceType                       | `kind`                                                           |                                             |
| Account                          | User                                                             | "Account" is avoided in code                |
| Document (for any source)        | Source                                                           | "Document" is reserved for chunked text     |
| Dashboard / projects view        | Dashboard (`/dashboard`)                                         | "Home" is the public landing page (`/home`) |
