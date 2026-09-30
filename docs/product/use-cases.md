# Use cases

The 20 use cases from the team's use-case document. Each one lists who acts, what must be
true first, the step-by-step flow, what's true after, what can go wrong, and the
performance or quality target.

> These are updated to our stack — Next.js and Supabase — so they describe what we
> actually build. What changed from the original spec, and why:
> [spec-vs-build.md](spec-vs-build.md). What's built so far: the status column in
> [architecture.md](../design/architecture.md#screens-and-routes).

**Conventions**

- **User** steps are what the person does. **System** steps are how the app responds
- IDs are `UC-01` … `UC-20`, the form the SRS uses for traceability
- UC-01 and UC-16 come from the **SRS versions**, which add numbered error codes and NFR
  IDs. The rest come from the use-case document
- **Stretch goals** — UC-12 (links), UC-17 (summaries), UC-18 and UC-19 (analysis). Build
  the rest first
- "Network connection lost" appears in almost every use case. It always means: show a
  connection error and let the user retry

## Index

| ID                                                       | Use case                                    | Area       |
| -------------------------------------------------------- | ------------------------------------------- | ---------- |
| [UC-01](#uc-01--create-account)                          | Create account                              | Account    |
| [UC-02](#uc-02--log-in-with-google)                      | Log in with Google                          | Account    |
| [UC-03](#uc-03--log-in)                                  | Log in with an emailed code                 | Account    |
| [UC-04](#uc-04--log-out)                                 | Log out                                     | Account    |
| [UC-05](#uc-05--edit-account)                            | Edit account                                | Account    |
| [UC-06](#uc-06--delete-account)                          | Delete account                              | Account    |
| [UC-07](#uc-07--create-project)                          | Create project                              | Projects   |
| [UC-08](#uc-08--edit-project)                            | Edit project                                | Projects   |
| [UC-09](#uc-09--view-projects)                           | View projects                               | Projects   |
| [UC-10](#uc-10--delete-project)                          | Delete project                              | Projects   |
| [UC-11](#uc-11--upload-source)                           | Upload source (document / transcript)       | Sources    |
| [UC-12](#uc-12--link-external-source)                    | Link external source (website / video)      | Sources    |
| [UC-13](#uc-13--view-search-and-organise-sources)        | View, search, and organise sources          | Sources    |
| [UC-14](#uc-14--remove-source)                           | Remove source from project                  | Sources    |
| [UC-15](#uc-15--automatic-parsing-chunking-and-indexing) | Automatic parsing, chunking, and indexing   | Processing |
| [UC-16](#uc-16--ask-a-source-constrained-question)       | Ask a source-constrained question (Q&A)     | AI         |
| [UC-17](#uc-17--summarise-sources)                       | Summarise a source or set of sources        | AI         |
| [UC-18](#uc-18--compare-across-sources)                  | Compare concepts, arguments, or data        | AI         |
| [UC-19](#uc-19--extract-themes-and-insights)             | Extract themes, concepts, and relationships | AI         |
| [UC-20](#uc-20--inspect-ai-answer-sources)               | Inspect AI answer sources (explainability)  | AI         |

---

## Account

Sign-in is **passwordless**: Supabase Auth emails a 6-digit code. Signing up and logging
in are the same flow — an unknown email gets a new user. There are no passwords, so the
spec's password rules, password errors, and NFR-02 don't apply.

### UC-01 · Create account

The first sign-in with a new email creates the account.

**Actors:** User (primary), System · **Priority:** High

**Preconditions**

- User is not signed in
- User has a network connection

**Flow**

1. User goes to the landing page and clicks **Create Account** (or **Log In** — same
   form)
2. System shows the sign-in form at `/login`
3. User enters an email
4. System validates the email format
5. System asks Supabase Auth to email a 6-digit code
6. User enters the code
7. System verifies the code. Supabase creates the user if the email is new
8. System redirects to the dashboard

**Postconditions**

- A user exists in `auth.users`
- The user is signed in and on the dashboard

**Errors**

- **E1** Email empty → field validation error
- **E2** Email format invalid → email format error
- **E3** Code wrong or expired → "That code is wrong or has expired"
- **E4** Code can't be sent (bad address, email rate limit) → ask the user to check the
  address and retry
- **E5** Network lost → network error, prompt to retry

**Non-functional**

- **NFR-01** Code submit to signed in: under **5 s** at normal load (not counting email
  delivery)
- **NFR-03** Form works on every supported browser and screen size

### UC-02 · Log in with Google

**Status: not built.** Supabase Auth has a Google provider, so this needs only a
**Continue with Google** button and one callback route — no token handling in our code.

**Actors:** User

**Preconditions**

- User is not signed in
- User has a network connection and a Google account

**Flow**

1. User clicks **Continue with Google**
   - System calls Supabase's `signInWithOAuth` and redirects to Google
2. User signs in with Google
   - Google redirects to our callback route
   - System exchanges the code for a session (`exchangeCodeForSession`). Supabase
     validates the token and finds or creates the user
   - System redirects to the dashboard

**Postconditions**

- User is signed in and can use every feature

**Errors**

- User cancels at Google, or Google sign-in fails → back to `/login` with a message
- Code exchange fails → back to `/login` with a message
- Network lost

**Non-functional**

- Whole sign-in completes within **10 s**

### UC-03 · Log in

The same flow as [UC-01](#uc-01--create-account), for an email that already has a user.

**Actors:** User

**Preconditions**

- User is not signed in
- User has a network connection

**Flow**

1. User clicks **Log In**, enters their email, then the code from their inbox
2. System verifies the code and redirects to the dashboard

**Postconditions**

- User is signed in and can use every feature

**Errors**

- Code wrong or expired
- Network lost

Supabase rate-limits code emails, which covers the spec's "lock out after repeated
failures".

**Non-functional**

- Code submit to signed in within **5 s**

### UC-04 · Log out

**Actors:** User

**Preconditions**

- User is signed in

**Flow**

1. User clicks **Log Out**
   - System shows a confirmation dialog
2. User confirms
   - System calls Supabase `signOut`, which ends the session and clears the cookies
   - System redirects to `/login`

**Postconditions**

- User is signed out

**Errors**

- Network lost

**Non-functional**

- Logout completes within **3 s**

### UC-05 · Edit account

The only account detail today is the email.

**Actors:** User

**Preconditions**

- User is signed in
- User has a network connection

**Flow**

1. User opens `/settings`
   - System shows the current email
2. User enters a new email and clicks **Save Changes**
   - System validates the format
   - System calls Supabase `updateUser`, which emails a confirmation link to the new
     address
3. User confirms from their inbox
   - Supabase switches the email

**Postconditions**

- The user signs in with the new email from now on

**Errors**

- Invalid email format
- New email already belongs to another user
- Network lost

**Non-functional**

- Save completes within **3 s** (not counting email delivery)

### UC-06 · Delete account

**Actors:** User

**Preconditions**

- User is signed in
- User has a network connection

**Flow**

1. User opens `/settings` and clicks **Delete Account**
   - System shows a confirmation dialog explaining the consequences
2. User confirms
   - System deletes the user's files from the `sources` bucket
   - System deletes the user from Supabase Auth, server-side with the service role
   - The database deletes everything else by cascade — projects, sources, chunks, chats,
     citations
   - System signs the user out and redirects to `/home`

**Postconditions**

- The user and all their data are gone
- User is signed out

**Errors**

- Session expired mid-deletion
- Server or database error prevents full deletion
- Network lost

**Non-functional**

- Completes within **5 s**, not counting a long-running file cleanup if one is used
- This is the GDPR-style right to erasure — see [requirements.md](requirements.md#legal-and-compliance)
- ⚠️ Files don't cascade. Deleting the user without clearing their Storage folder leaves
  their uploads behind

---

## Projects

### UC-07 · Create project

**Actors:** User

**Preconditions**

- User is logged in
- User has a network connection

**Flow**

1. User clicks **Create Project**
   - System shows the project form
2. User enters a title and, optionally, a description
   - System validates the input
3. User clicks **Create**
   - System creates the project
   - System opens it

**Postconditions**

- The project exists and appears in the user's project list

**Errors**

- Title empty or over the character limit
- Server or database error
- Network lost

**Non-functional**

- Completes within **3 s**

### UC-08 · Edit project

**Actors:** User

**Preconditions**

- User is logged in
- User has a network connection
- Project exists and belongs to the user

**Flow**

1. User opens a project and selects **Edit Project**
   - System shows the project details in an edit form
2. User changes title, description, or organisation
   - System validates the input
3. User clicks **Save Changes**
   - System saves the project
   - System confirms the change was saved

**Postconditions**

- Project is updated in the database and the UI

**Errors**

- Project not found
- User not allowed to edit this project
- Invalid input
- Network lost

**Non-functional**

- Completes within **3 s**

### UC-09 · View projects

**Actors:** User

**Preconditions**

- User is logged in
- User has a network connection

**Flow**

1. User goes to the dashboard / projects page
   - System loads the user's projects
   - System shows the list, with search and sort if available
2. User picks a project
   - System opens its workspace

**Postconditions**

- User can see and open their projects

**Errors**

- Server error stops the list loading
- Network lost

**Non-functional**

- List loads within **3 s** for a typical account

### UC-10 · Delete project

**Actors:** User

**Preconditions**

- User is logged in
- User has a network connection
- Project exists and belongs to the user

**Flow**

1. User opens project settings
   - System shows project options
2. User clicks **Delete Project**
   - System shows a confirmation dialog explaining the consequences
3. User confirms
   - System deletes the project and everything in it — sources, indexes, chats
   - System removes it from the project list

**Postconditions**

- Project and all its data are gone from the database and the UI

**Errors**

- User not allowed to delete this project
- Server or database error
- Network lost

**Non-functional**

- Completes within **5 s**, not counting a long-running background purge if one is used

---

## Sources

### UC-11 · Upload source

Documents and transcripts.

**Actors:** User

**Preconditions**

- User is logged in
- User has a network connection
- User is inside a project

**Flow**

1. User clicks **Upload Source**
   - System opens a file picker
2. User picks one or more files — PDF, plain text, or Markdown. A transcript is a text
   file
   - System checks file type and size (the bucket allows 50 MiB)
3. User confirms the upload
   - System uploads each file to Storage at `{user_id}/{project_id}/{file}`
   - System inserts a `sources` row for each, with status `pending`
   - The worker picks it up ([UC-15](#uc-15--automatic-parsing-chunking-and-indexing))

**Postconditions**

- The new sources appear in the project's source list, ready for processing

**Errors**

- Unsupported file type
- File over the size limit
- Upload interrupted / network lost
- Server storage error

**Non-functional**

- Once the transfer finishes, confirmation and source record within **5 s** for a
  typical document

### UC-12 · Link external source

Websites and videos. **Stretch goal** — `sources.kind` doesn't allow links yet.

**Actors:** User

**Preconditions**

- User is logged in
- User has a network connection
- User is inside a project

**Flow**

1. User clicks **Add Link**
   - System shows a URL field
2. User pastes a URL (website, YouTube, …)
   - System validates the URL format
3. User clicks **Add**
   - System fetches and stores the link's metadata
   - System pulls in the content where supported — page text, video transcript
   - System queues parsing and indexing ([UC-15](#uc-15--automatic-parsing-chunking-and-indexing))

**Postconditions**

- The linked source appears in the project's source list, ready for processing

**Errors**

- Invalid URL
- Content can't be fetched — blocked, removed, or behind a login
- Unsupported content type
- Network lost

**Non-functional**

- URL validation within **1 s**
- Metadata fetched within **5 s** for a typical source

### UC-13 · View, search, and organise sources

**Actors:** User

**Preconditions**

- User is logged in
- User has a network connection
- User is inside a project with at least one source

**Flow**

1. User opens the **Sources** panel
   - System loads and lists the project's sources
2. User searches or filters
   - System updates the list to match
3. User selects a source
   - System shows a preview and details (file viewer or link preview)

**Postconditions**

- User can browse, search, and organise the project's sources

**Errors**

- Source record missing or corrupted
- Viewer can't render the source
- Network lost

**Non-functional**

- List updates within **1 s** for a typical project

### UC-14 · Remove source

**Actors:** User

**Preconditions**

- User is logged in
- User has a network connection
- User is inside a project
- The source exists in that project

**Flow**

1. User selects a source and clicks **Remove** / **Delete**
   - System shows a confirmation dialog
2. User confirms
   - System deletes the `sources` row. Its chunks and any citations of them go with it
   - System deletes the file from Storage — the database does not do this

**Postconditions**

- The source is gone and **no longer influences AI answers**

**Errors**

- User not allowed to remove this source
- Server or database error
- Network lost

**Non-functional**

- Completes within **5 s** for a typical source

---

## Processing

### UC-15 · Automatic parsing, chunking, and indexing

Runs in the background after an upload or link. The user starts it indirectly.

Done by a separate **Python worker** (CECS491-11/12, not built) using the service role.

**Actors:** Worker; User (initiator, via upload)

**Preconditions**

- A source has status `pending`
- The worker can reach the database, Storage, and the embedding API

**Flow**

1. Worker picks up a `pending` source and sets it to `processing`
   - Downloads the file and extracts its text
   - Writes what it learns (author, page count, …) to `sources.metadata`
2. Worker splits the text into chunks
   - Each chunk keeps its source, order (`chunk_index`), and page number
   - Embeds each chunk (OpenAI `text-embedding-3-small`) and inserts it into
     `document_chunks`. The vector index updates itself
3. Worker sets the source to `ready`
   - The app shows the status to the user

**Postconditions**

- The source is parsed, chunked, indexed, and usable for grounded AI answers

**Errors**

- Parsing fails — unsupported format or corrupted file → `failed` with a
  `processing_error`
- Embedding API unavailable → `failed`, can be retried
- Processing times out or exceeds resource limits → `failed`

**Non-functional**

- Handles large documents and many sources without significant slowdown
- Status updates within **30 s** for a moderate-size file
- Runs outside the web app, so it never blocks the UI ([requirements.md](requirements.md#scalability))

---

## AI

### UC-16 · Ask a source-constrained question

The core feature. Q&A that answers **only** from the project's sources.

**Actors:** User (primary), LLM · **Priority:** High

**Preconditions**

- User is logged in
- User has a network connection
- User is inside a project
- The project has **at least one `ready` source**

**Flow**

1. User opens the project workspace
2. User types a natural-language question into the chat input
3. User submits (Enter or **Send**)
4. System embeds the question and calls `match_document_chunks` — relevant chunks
   **strictly from the active project**
5. System sends the retrieved chunks and the question to the LLM as context
6. LLM writes an answer grounded **only** in that content
7. System streams the answer to the UI
8. System attaches citations to the source segments used
9. User reads the answer and can click any citation to open the source with the
   supporting segment highlighted ([UC-20](#uc-20--inspect-ai-answer-sources))

**Postconditions**

- User has a grounded, cited answer drawn only from the project's `ready` sources
- Citations show as clickable links in the answer
- Both messages are saved to `chat_messages`, and the citations to `citations`

**Errors**

- **E1** Nothing relevant in the sources → "No matching information found in your
  sources". **Never fabricate an answer**
- **E2** No source is `ready` yet → ask the user to wait for processing to finish
- **E3** AI service unavailable → service error, suggest retry
- **E4** Network lost → connection error
- **E5** Retrieval returns nothing → tell the user; suggest adding more relevant sources

**Non-functional**

- **NFR-04** Answer starts streaming within **3 s** of retrieval finishing, for typical
  questions
- **NFR-05** No external data or knowledge beyond the project's sources
- **NFR-06** Clicking a citation opens the source in under **1 s** once it's loaded
- **NFR-07** Source-grounded correctness over speculative answers

### UC-17 · Summarise sources

One source or several. **Stretch goal** (CECS491-15).

**Actors:** User

**Preconditions**

- User is logged in
- User has a network connection
- User is inside a project
- The selected source(s) are `ready`

**Flow**

1. User asks for a summary of one or more sources
   - System retrieves content **strictly from the selected sources**
   - System writes a summary, optionally structured (bullets, sections)
   - System cites the key supporting segments where possible

**Postconditions**

- User has a grounded summary of the selected material

**Errors**

- Selected sources not found or not `ready`
- No text available — empty transcript, parse failure
- Network lost

**Non-functional**

- Within **10 s** for moderate-size sources

### UC-18 · Compare across sources

Concepts, arguments, or data. **Stretch goal** (CECS491-16).

**Actors:** User

**Preconditions**

- User is logged in
- User has a network connection
- User is inside a project with **at least two `ready` sources**

**Flow**

1. User asks for a comparison, e.g. "compare X in Source A vs Source B"
   - System retrieves relevant chunks from several sources in the project
   - System writes a side-by-side comparison — similarities and differences
   - System cites every compared claim back to its source

**Postconditions**

- User has a comparison grounded in several project sources

**Errors**

- One or more sources not `ready`
- Not enough evidence in the sources to compare
- Network lost

**Non-functional**

- Every major point cites its source where possible

### UC-19 · Extract themes and insights

Key themes, concepts, and relationships. **Stretch goal** (CECS491-16).

**Actors:** User

**Preconditions**

- User is logged in
- User has a network connection
- User is inside a project with **at least two `ready` sources**

**Flow**

1. User asks for insights, e.g. "what are the main themes across these sources?"
   - System retrieves representative evidence from the project's sources
   - System groups the insights into themes
   - System lists the evidence and citations for each theme

**Postconditions**

- User has a theme-by-theme breakdown grounded in the project's sources

**Errors**

- Project too large to process within limits
- Sources insufficient for meaningful themes
- Network lost

**Non-functional**

- Correctness over speculation
- Transparent traceability to supporting evidence

> An earlier draft of this use case didn't require at least two sources. The later
> version (above) is used here.

### UC-20 · Inspect AI answer sources

Explainability — how a user checks where an answer came from.

**Actors:** User

**Preconditions**

- User is logged in
- User has a network connection
- User has an AI answer with citations

**Flow**

1. User clicks a citation in an AI response
   - System follows citation → chunk → source, opens the file at the chunk's page, and
     highlights the passage (`anchor_text`, or the chunk's text)
   - System shows the source's details — title, kind, upload date
2. User moves between citations
   - System updates the highlight and context preview

**Postconditions**

- User can verify where every point in the answer came from

**Errors**

- Citation target missing — can't happen for a deleted source, since its citations are
  deleted with it. Can happen if the file is missing from Storage
- Viewer can't render the source
- Network lost

**Non-functional**

- Citation navigation feels instant — under **1 s** once the source is loaded
