# Requirements

Everything the RFP and SRS require, grouped by topic. Measurable targets (seconds,
limits) live in [non-functional-requirements.md](non-functional-requirements.md).
Step-by-step behaviour lives in [use-cases.md](use-cases.md).

> Updated to our stack: Next.js on the front and back, Supabase for auth, database, and
> files. Where the spec named example vendors or asked for something Supabase already
> does, this page says how it's met. The original wording and why it changed:
> [spec-vs-build.md](spec-vs-build.md).

## Functional requirements

From the RFP's "Features We Need", with the use case that details each one.

### 1. Account management

| Requirement    | What it means                                                                      | Use case     |
| -------------- | ---------------------------------------------------------------------------------- | ------------ |
| Create account | Sign in with an emailed code; a new email gets an account. Required to use the app | UC-01        |
| Log in         | With an emailed code, or with Google (not built yet)                               | UC-02, UC-03 |
| Log out        | End the session                                                                    | UC-04        |
| Edit account   | Change the sign-in email                                                           | UC-05        |
| Delete account | Permanently delete the account **and all associated data**                         | UC-06        |

All five run on **Supabase Auth**. We write the forms and a few server actions — no
password storage, session tables, or token handling of our own.

### 2. Project / workspace management

A project is the container for a set of sources and the AI conversations about them.

| Requirement    | What it means                                        | Use case |
| -------------- | ---------------------------------------------------- | -------- |
| Create project | Create a project to hold sources and AI interactions | UC-07    |
| Edit project   | Change title, description, or organisation           | UC-08    |
| View projects  | See and open existing projects                       | UC-09    |
| Delete project | Permanently delete a project and its associated data | UC-10    |

### 3. Source ingestion and management

| Requirement           | What it means                                         | Use case |
| --------------------- | ----------------------------------------------------- | -------- |
| Upload sources        | PDFs, text files, transcripts                         | UC-11    |
| Link external sources | Websites and videos (e.g. YouTube) — stretch goal     | UC-12    |
| View sources          | Browse, search, and organise sources within a project | UC-13    |
| Remove sources        | Delete individual sources from a project              | UC-14    |

### 4. Content processing and indexing

All three are covered by UC-15, done by the Python worker.

- **Automatic parsing** — turn uploaded and linked sources into structured,
  machine-readable content
- **Chunking and indexing** — split content into segments and index them for fast
  retrieval
- **Context preservation** — keep the links between sources and their segments, so
  answers can be traced back

### 5. AI interaction

| Requirement             | What it means                                                     | Use case |
| ----------------------- | ----------------------------------------------------------------- | -------- |
| Source-constrained Q&A  | Answer questions strictly from the active project's sources       | UC-16    |
| Summarisation           | Summarise one source or a combined set — stretch goal             | UC-17    |
| Comparison and analysis | Compare concepts, arguments, or data — stretch goal               | UC-18    |
| Insight extraction      | Identify key themes, concepts, and relationships — stretch goal   | UC-19    |
| Explainability          | Every response references the source(s) behind it, where possible | UC-20    |

## Product-wide constraints

These apply to every feature.

- **Closed-context operation.** Inside a project, the AI must not use external or
  unknown data — only the user's sources
- **Accuracy and trust.** Minimise hallucinations. Correctness beats speculation
- **Scalability.** Large documents, many sources, and concurrent users without
  significant slowdown
- **Data privacy.** No user data is ever shared across accounts
- **No plugins.** Works in all four major browsers without custom plugins

## Supported source types (initial release)

| Kind          | Types                                                  | Status       |
| ------------- | ------------------------------------------------------ | ------------ |
| File upload   | PDF, plain text, Markdown. A transcript is a text file | Schema ready |
| External link | Website URLs, YouTube links                            | Stretch goal |

Uploads are capped at 50 MiB by the storage bucket. YouTube videos are assumed to have
transcripts; videos without one may not be fully indexed.

## Software requirements

- **Web application** — responsive; adapts to different screen sizes
- **Authentication** — every user signs in. Supabase Auth (see [Security](#security))
- **User interface** — intuitive and usable by non-technical users
- **Performance** — fast ingestion, indexing, and AI response times
- **Security** — input validation and protection against common web vulnerabilities

## User interface

The screens the SRS asks for (§3.1). All must be responsive and usable by
non-technical users. For the route each one lives at, see
[architecture.md](../design/architecture.md#screens-and-routes).

| Screen                    | Contains                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| Landing / home page       | Introduction; "Log In" and "Create Account" calls to action                                 |
| Sign-in form              | Email, then the 6-digit code. One form for sign-up and log-in; "Continue with Google" later |
| Dashboard / projects view | Grid or list of the user's projects; create, open, edit, delete                             |
| Project workspace         | Split panel: Sources panel (left), AI Chat panel (right)                                    |
| Sources panel             | Upload button, Add Link button, searchable/filterable list, preview                         |
| AI chat panel             | Natural-language input, streaming responses, inline citation links                          |
| Account settings page     | View and change email; log out; delete account                                              |

**Hardware:** none beyond a standard desktop or laptop. Uploads use the browser's normal
file dialog. No scanners, VR, or other peripherals.

## Environment and compatibility

| Area     | Requirement                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Devices  | Desktops and laptops — Windows 10+, macOS 12+, modern Linux                                                                                      |
| Browsers | Latest stable Chrome, Firefox, Safari, Edge                                                                                                      |
| Network  | A stable internet connection is assumed                                                                                                          |
| Storage  | Temporary data (e.g. session context) may live on the client. Permanent data (accounts, sources, projects) must be stored securely on the server |
| Server   | The Next.js app on a Node host; Supabase hosted. Where the app is hosted isn't decided                                                           |

## External interfaces

What the system talks to. The SRS named example vendors; this is what we use.

| Interface    | SRS example                     | We use                                                                            |
| ------------ | ------------------------------- | --------------------------------------------------------------------------------- |
| Identity     | Google OAuth2                   | **Supabase Auth** — emailed codes now, its Google provider later                  |
| Database     | PostgreSQL or MongoDB           | **Supabase Postgres**                                                             |
| Vector index | Pinecone or Weaviate            | **pgvector** in the same database                                                 |
| File storage | AWS S3 or equivalent            | **Supabase Storage**, private bucket `sources`                                    |
| Embeddings   | —                               | **OpenAI `text-embedding-3-small`** (1536 dimensions)                             |
| LLM          | OpenAI or Anthropic             | Not chosen yet                                                                    |
| YouTube      | YouTube Data API v3 or `yt-dlp` | Stretch goal                                                                      |
| Backend      | Node.js or Python server        | **Next.js** route handlers and server actions; a **Python worker** for processing |

### Communication

- **HTTPS only**, TLS 1.2 or higher. Supabase serves HTTPS; the app's host must too
- **REST API** for projects (`/api/projects`), later sources. Unversioned — see
  [Maintainability](#maintainability)
- **Streaming** for AI answers. The transport (streamed route-handler response, or
  Supabase Realtime on `chat_messages`) isn't decided
- **Sessions** are Supabase's: a JWT in a cookie pair, refreshed by `proxy.ts`

## Data storage

- **Postgres** (ACID) for projects, sources, chunks, and chat — with **pgvector** for
  chunk embeddings in the same database
- **Supabase Storage** for uploaded files
- **Backups** of permanent data with a retention policy. Supabase's backup options
  depend on the plan — not decided yet

## Security

| Requirement                            | How it's met                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HTTPS (TLS 1.2+) in transit            | Supabase and the app host                                                                                                                              |
| Sessions with configurable expiry      | Supabase Auth JWTs. `jwt_expiry` in `supabase/config.toml` (1 hour); a project setting when hosted. Codes expire too (`otp_expiry`)                    |
| Third-party tokens checked server-side | Supabase exchanges and verifies the Google code; our code only calls `exchangeCodeForSession`                                                          |
| Verified identity on the server        | `getClaims()` verifies the JWT signature. Never trust `getSession()` on the server                                                                     |
| Input validated server-side            | zod in every route handler and server action, even when the form already validated                                                                     |
| SQL injection                          | Queries go through the Supabase client, which parameterises them. No SQL built from strings                                                            |
| XSS                                    | React escapes output. Don't use `dangerouslySetInnerHTML` on AI or user text                                                                           |
| CSRF                                   | Server actions: Next.js checks `Origin` against `Host`. Route handlers don't get that check — keep state-changing endpoints to `POST`/`PATCH`/`DELETE` |
| **Strict data isolation**              | **Row-level security** on every table and on the storage bucket, keyed on the project owner                                                            |
| Passwords stored as salted hashes      | Doesn't apply — there are no passwords                                                                                                                 |
| Secrets stay on the server             | Only `NEXT_PUBLIC_*` reaches the browser. The service-role key is for the worker and account deletion only                                             |

## Scalability

- **Horizontal scaling** — concurrent users and parallel document processing without
  significant slowdown. The app is stateless; more workers can pull `pending` sources
- **50+ sources per project** without retrieval slowing down. Chunk search uses an HNSW
  index, filtered by project
- **Processing runs in the worker**, outside the web app, so it never blocks the UI

## Legal and compliance

- **Right to erasure.** Users can permanently delete their account and everything tied to
  it — projects, sources, AI history (GDPR-style). The database cascades from the user;
  Storage files must be deleted by the app
- **Privacy policy.** Data handling is documented in a policy users can read
- **Third-party terms.** LLM, embedding, and Google sign-in usage complies with those
  providers' terms of service

## Maintainability

- **Modular design.** Auth is Supabase's, ingestion is the worker's, and the AI pipeline
  will live in `lib/` — each can change on its own
- **Swappable LLM provider.** Call the model from one `lib/` function, so switching
  providers touches one file
- **API versioning.** The SRS asked for `/api/v1/`. The API is unversioned today
  (`/api/projects`). Decide before anything outside our own frontend depends on it

## Assumptions and dependencies

- Users have a stable internet connection
- AI features depend on a third-party LLM API. Its downtime takes AI features down
- Everything depends on Supabase. Its outage takes sign-in and data down
- Sign-in depends on email delivery. Supabase's built-in email is rate-limited; a custom
  SMTP provider is needed before real users arrive
- Google sign-in, once added, depends on Google
- YouTube transcripts are available for linked videos
- LLM, embedding, and Supabase pricing and rate limits stay within the project budget

## Documentation deliverables

Shipped alongside the software:

- **User guide** — accounts, projects, sources, and AI features, step by step
- **In-app help and tooltips** — for non-technical users
- **Developer README** — setup, environment configuration, deployment
- **API documentation** — the internal backend endpoints
