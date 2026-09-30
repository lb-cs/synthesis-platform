# Product overview

**AI-Powered Research and Synthesis Platform** — repo name Synthesis Platform. CECS 491A,
California State University, Long Beach.

## In one paragraph

A web app where users upload their own source material — PDFs, text files, transcripts,
and later websites and YouTube videos — into a **project**, then ask an AI questions about
it. The AI answers **only from those sources**, and every answer cites where it came
from. The goal is a research workspace people can trust: better comprehension, faster
synthesis, and support for critical thinking, without the AI making things up.

## The core principle: closed context

This is the one rule that makes the product what it is. Every AI feature must follow it.

- **In-project answers use only the project's sources.** No outside knowledge, no web,
  no training-data "general knowledge"
- **No answer beats a made-up answer.** If the sources don't cover a question, say so
  ("No matching information found in your sources") — never fabricate
- **Every claim is traceable.** Answers, summaries, comparisons, and insights cite the
  source and the exact passage behind them. A user can click a citation and see it
- **Correctness over speculation.** When in doubt, the AI stays quiet rather than guesses

## Who it's for

- **Students** working through course readings and lecture transcripts
- **Researchers** synthesising many papers on one topic
- **Professionals and organisations** centralising complex reference material

The interface must work for **non-technical users** handling complex material.

## What a user can do

| Area             | Capabilities                                                      | Use cases     |
| ---------------- | ----------------------------------------------------------------- | ------------- |
| Account          | Sign in with an emailed code (Google later), log out, delete all  | UC-01 – UC-06 |
| Projects         | Create, edit, view, delete research projects                      | UC-07 – UC-10 |
| Sources          | Upload files, add links, browse / search / preview, remove        | UC-11 – UC-14 |
| Processing       | Automatic parsing, chunking, and indexing, with visible status    | UC-15         |
| AI — Q&A         | Ask questions answered only from the project's sources            | UC-16         |
| AI — synthesis   | Summaries, cross-source comparisons, theme and insight extraction | UC-17 – UC-19 |
| AI — explainable | Click any citation to open the source at the supporting passage   | UC-20         |

Full detail: [use-cases.md](use-cases.md).

## The main screen

The **project workspace** is a split panel:

- **Left — Sources panel.** Upload, add link, search/filter the list, preview a source
- **Right — AI chat panel.** Ask in natural language; answers stream in with inline,
  clickable citations

## Scope and timeline

- **Deadline:** full platform complete by **December 2026** (per the RFP)
- Requirements may change within the project timeline
- The SRS marks features **High** (initial release), **Medium** (early iterations), or
  **Low** (may be deferred). Only UC-01 and UC-16 were given a priority in writing; both
  are High
- The team has since marked **summaries (UC-17)** and **cross-source analysis (UC-18,
  UC-19)** as stretch goals — see [spec-vs-build.md](spec-vs-build.md)

## Team — Quintessential Algorithms

| Name            | Role        |
| --------------- | ----------- |
| Alfredo Pasten  | Team leader |
| Arya Esfahani   | Member      |
| Carlos Aguilera | Member      |
| Mulero Alamou   | Member      |
| Mahdi Alampour  | Member      |

Issue tracker: Jira project `CECS491` —
<https://quintessentialalgorithms.atlassian.net/browse/CECS491>

## Where this came from

The product and design docs are a markdown restructuring of the team's CECS 491A
documents. The originals are Word files kept outside the repo.

| Original document                 | Date       | Now lives in                                                                                                    |
| --------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| RFP — Request for Proposal        | 2026       | [requirements.md](requirements.md), this page                                                                   |
| SRS — Software Requirements Spec. | March 2026 | [requirements.md](requirements.md), [non-functional-requirements.md](non-functional-requirements.md), this page |
| AI Research Platform Use Cases    | 2026       | [use-cases.md](use-cases.md)                                                                                    |
| List of Objects                   | 2026       | [architecture.md](../design/architecture.md), [data-model.md](../design/data-model.md) — adapted to the stack   |
| List of Entity Methods            | March 2026 | [data-model.md](../design/data-model.md#spec-operations--how-they-happen) — adapted to the stack                |

The SRS follows IEEE Std 830-1998 and references OAuth 2.0 (RFC 6749) and JWT
(RFC 7519).

These docs are **adapted to our stack**, not a verbatim copy. The object list's
controllers and several entities (sessions, tokens, processing jobs) are replaced by
what Next.js and Supabase already do. The Word files keep the original wording.
