# Spec vs build

What changed between the team's original spec documents (spring 2026) and what we
actually build — and why. The rest of `docs/product/` and `docs/design/` is already
updated to match; this page is the record of **what** was changed, so nobody "fixes" the
code back to the old spec.

_Last checked against the code: 2026-10-30 (`main` at `f97774e`, end of Sprint 3)._ Update this page when
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
| Embeddings          | —                                                           | OpenAI `text-embedding-3-small` through Vercel AI Gateway, in the worker and `lib/ai.ts`                                                         |
| LLM provider        | OpenAI or Anthropic                                         | **Vercel AI Gateway** in front of the model. The model id lives in `lib/ai.ts` only                                                              |
| API versioning      | `/api/v1/…` (SRS §6.5)                                      | Unversioned: `/api/projects`                                                                                                                     |
| Stretch goals       | Everything in the RFP                                       | Links (UC-12), summaries (UC-17, `CECS491-15`), analysis (UC-18, UC-19, `CECS491-16`)                                                            |

## By use case

| Use case               | Status in code                                                                                                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UC-01 Create account   | Built as emailed-code sign-in (`/login`). The spec's password rules, password errors, and NFR-02 were dropped                                                                                                                            |
| UC-02 Google           | Not built. Needs a button and one callback route; Supabase does the rest                                                                                                                                                                 |
| UC-03 Log in           | Same flow as UC-01                                                                                                                                                                                                                       |
| UC-04 Log out          | Built: Sign out in Settings and the sidebar user menu (`signOut` in `app/login/actions.ts`)                                                                                                                                              |
| UC-05 Edit account     | Built: Settings emails a 6-digit code to the new address, like sign-in, instead of a link. Needs Supabase's Secure email change off, so the old address gets no code (CECS491-65)                                                        |
| UC-06 Delete account   | Built: Settings > Delete account clears the user's Storage folder, deletes the auth user with the service role (`lib/account.ts`), and the database cascades the rest                                                                    |
| UC-07 – UC-10 Projects | Built: dashboard, `/projects/new`, `/projects/[projectId]/edit` (edit and delete), and the REST API (`/api/projects`, `/api/projects/[projectId]`). Title 1–100 chars; blank description is `null`                                       |
| UC-11 Upload           | Built on the Sources page: PDF, text, and Markdown up to 50 MiB. Kinds are `pdf` and `text` — Markdown and transcripts are `text`                                                                                                        |
| UC-12 Links            | **Stretch goal.** `sources.kind` doesn't allow links yet                                                                                                                                                                                 |
| UC-13 View sources     | Built: list, search, filter by status and kind, details sheet. Status refreshes every 3 s while a source is `pending` or `processing`, on the Sources page and the workspace panel                                                       |
| UC-14 Remove source    | Built: deletes the row (cascading to its chunks and their citations) and the Storage file                                                                                                                                                |
| UC-15 Processing       | Built: the worker claims, parses, chunks, and embeds sources (CECS491-68, -69, -70) and runs on Railway (CECS491-77). Rate limits and Gateway errors are retried with backoff. A failed source shows why and can be retried (CECS491-71) |
| UC-16 Q&A              | Built, naive: the workspace chat streams answers that cite whole sources as `[n]` (CECS491-72, -74). Retrieval over chunks and `citations` rows are not wired (CECS491-73)                                                               |
| UC-17 Summaries        | **Stretch goal** (Jira `CECS491-15`). Placeholder page at `/projects/[projectId]/summaries`                                                                                                                                              |
| UC-18, UC-19 Analysis  | **Stretch goal** (Jira `CECS491-16`). Placeholder page at `/projects/[projectId]/analysis`                                                                                                                                               |
| UC-20 Citations        | Partly built: a `[n]` chip opens the whole source file, with no page. Jumping to the cited page is CECS491-78. In the schema a citation points at a chunk, which gives source and page                                                   |

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
