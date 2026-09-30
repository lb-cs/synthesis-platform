# Non-functional requirements

The measurable targets: how fast, how accurate, how safe. Security, scalability, and
compliance rules that aren't a single number are in
[requirements.md](requirements.md).

"Typical" and "moderate-size" are the spec's own words. Nobody has pinned them to a
number yet — agree one before writing a test against them.

## Numbered NFRs (from the SRS)

The SRS gives IDs to the NFRs of its two fully-specified use cases. Cite these IDs in
tickets and PRs.

| ID     | Category                   | Requirement                                                                         | Use case |
| ------ | -------------------------- | ----------------------------------------------------------------------------------- | -------- |
| NFR-01 | Performance                | Sign-in code submit to signed in, under 5 s at normal load                          | UC-01    |
| NFR-02 | Security                   | ~~Passwords stored as salted hashes~~ — **doesn't apply**: sign-in has no passwords | UC-01    |
| NFR-03 | Usability / compatibility  | Registration form works on all supported browsers and screen sizes                  | UC-01    |
| NFR-04 | Performance                | AI answer starts streaming within 3 s of retrieval finishing, for typical questions | UC-16    |
| NFR-05 | Accuracy / closed context  | No external data or knowledge beyond the project's sources for in-project answers   | UC-16    |
| NFR-06 | Usability / responsiveness | Citation navigation under 1 s once the source is loaded in the viewer               | UC-16    |
| NFR-07 | Accuracy / trust           | Source-grounded correctness over speculative AI responses                           | UC-16    |

## Time budgets by operation

Every timing target across the use cases.

| Operation                                | Target | Notes                                 | Use case     |
| ---------------------------------------- | ------ | ------------------------------------- | ------------ |
| Code submit to signed in                 | ≤ 5 s  | Normal load; excludes email delivery  | UC-01, UC-03 |
| Google sign-in, end to end               | ≤ 10 s | Not built yet                         | UC-02        |
| Logout                                   | ≤ 3 s  |                                       | UC-04        |
| Edit account                             | ≤ 3 s  | Excludes the confirmation email       | UC-05        |
| Delete account                           | ≤ 5 s  | Excludes a long file cleanup, if used | UC-06        |
| Create project                           | ≤ 3 s  |                                       | UC-07        |
| Edit project                             | ≤ 3 s  |                                       | UC-08        |
| Load project list                        | ≤ 3 s  | Typical account                       | UC-09        |
| Delete project                           | ≤ 5 s  | Excludes a long file cleanup, if used | UC-10        |
| Upload confirmed + source record created | ≤ 5 s  | After the file transfer finishes      | UC-11        |
| Validate a link URL                      | ≤ 1 s  | Stretch goal                          | UC-12        |
| Fetch link metadata                      | ≤ 5 s  | Stretch goal                          | UC-12        |
| Update source list (search / filter)     | ≤ 1 s  | Typical project                       | UC-13        |
| Remove source                            | ≤ 5 s  | Typical source                        | UC-14        |
| Processing status update                 | ≤ 30 s | Moderate-size file                    | UC-15        |
| AI answer starts streaming               | ≤ 3 s  | After retrieval completes (NFR-04)    | UC-16        |
| Generate summary                         | ≤ 10 s | Stretch goal                          | UC-17        |
| Open a cited source                      | < 1 s  | Once the source is loaded (NFR-06)    | UC-16, UC-20 |

## Accuracy and trust

These define the product. See [the core principle](README.md#the-core-principle-closed-context).

- **Closed context** — in-project AI output uses only the project's sources (NFR-05)
- **No fabrication** — with nothing relevant, say so rather than answer (UC-16 E1)
- **Correctness over speculation** — Q&A (NFR-07) and insight extraction (UC-19)
- **Citations** — every major point of a comparison cites its source, where possible
  (UC-18); every theme lists its evidence (UC-19); summaries cite key segments (UC-17)
- **Traceability** — every chunk keeps its link to the source it came from (UC-15), so
  any claim can be followed back (UC-20)
- **Removal is total** — a removed source no longer influences AI answers (UC-14)

## Scale

- Large documents and many sources, without significant slowdown (UC-15)
- **50+ sources per project** with no retrieval slowdown — HNSW index on chunk embeddings
- Concurrent users, and several sources processed in parallel by the worker
- Processing runs in the worker, outside the web app — never blocks the UI

## Compatibility and usability

- Latest stable Chrome, Firefox, Safari, Edge — no plugins
- Windows 10+, macOS 12+, modern Linux desktops and laptops
- Responsive at every screen size
- Usable by non-technical users; in-app help and tooltips
