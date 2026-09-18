---
name: refresh-docs
description: Audit a repo's docs and agent instructions (CLAUDE.md, AGENTS.md, README, .cursor/rules, .github/copilot-instructions.md) against the actual code, fix what drifted, and promote high-stakes discoveries into the agent docs. Use when asked to update stale docs, check whether docs are current, or refresh agent instructions.
user-invocable: true
---

# /refresh-docs — Verify docs against reality, then fix

Docs rot silently. Your job is to **prove each claim against the code** and correct
only what is actually wrong. Never rewrite a doc wholesale, never restructure a doc
that is accurate, and never add prose that the code already tells a reader.

## 1. Inventory

Find the docs and agent instruction files:

```bash
find . -iname "*.md" -o -iname "*.mdc" -o -iname "AGENTS.md" \
  | grep -vE "node_modules|/\.git/|vendor|dist|/build/|CHANGELOG" | head -50
```

Also check: `.cursor/rules/`, `.github/copilot-instructions.md`, `.claude/`,
`docs/`, `CONTRIBUTING.md`, per-package READMEs.

## 2. Verify, highest-payoff claims first

Work down this list. Every item is a factual claim you can check cheaply, and
each is a common rot site. **Read the source of truth, don't trust the doc.**

1. **Commands** — cross-check every documented command against `package.json`
   scripts (or Makefile / pyproject / Cargo.toml). Deleted and renamed scripts
   are the single most common staleness. Also verify a documented script still
   does what the doc says it does — read the script body, not just its name.
2. **Do the commands pass?** Run the test/lint/typecheck commands the doc tells
   people to run. A doc that recommends a broken command is worse than silence.
   Note misconfigured test globs, missing configs, and unrunnable suites.
3. **Paths and directories** — `ls` every path a doc names. Deleted dirs
   (`/certs`, `/scripts`) and undocumented new ones both matter.
4. **Named symbols** — every type, helper, composable, or util a doc tells an
   agent to use. `grep` for its definition. If it does not exist, the doc is
   actively sending agents to write broken code.
5. **Import paths and aliases** — resolve documented import examples against
   `tsconfig`/framework alias rules, then check what the codebase actually
   writes: `grep -rhoE "from '[^']*'" src/ | sort | uniq -c | sort -rn`.
6. **Claimed conventions vs. real usage** — when a doc says "use X", count X
   against its alternatives. If the doc says `useFetch` and the code has 30
   `useAsyncData`, the doc is wrong, not the code.
7. **Versions** — framework/language majors in the doc vs. the manifest.
   Majors change API advice; patch drift is noise, ignore it.
8. **Config facts** — flags the doc asserts (`ssr: false`, strict mode, ports)
   read straight from the config file.
9. **Generated artifacts** — schema/type/client files: are the doc's listed
   tables, models, views, endpoints still the real set?

Use `git log -S"<claim>" -- <file>` to see when something was removed; naming the
commit in the correction stops the next reader from re-adding it.

## 3. Promote high-visibility findings

While digging you will find facts that were never documented but should be. Add a
fact to the agent docs (`CLAUDE.md` / `AGENTS.md`) when getting it wrong is
**expensive or hard to notice**:

- Anything that touches production on merge or push — auto-deploying migrations,
  release-on-tag, infra applied from CI.
- Commands that look right but fail, and the working alternative.
- Required manual steps with a silent failure mode (the symptom, then the fix).
- Wrapper-only invocations — env vars set by a script, so a bare tool call breaks.
- Whole regions of generated code to ignore (vendored CMS tables, legacy schemas).
- Deliberate deviations from framework defaults, so nobody "fixes" them back.

Do **not** promote: anything derivable by reading the code, one-off bugs, personal
preference, or restatements of framework docs.

Note but do not silently fix out-of-scope problems you trip over (broken configs,
tracked secrets, unrunnable suites). Verify whether they're real, then report them.
If a credential file looks committed, check `git check-ignore -v <path>` and
`git ls-files` before raising alarm.

## 4. Editing rules

- Surgical edits. Preserve each doc's existing voice, heading structure, and
  density. A doc the user liked should still read like theirs.
- Fix the claim **and** give the working replacement. "`x` was removed" is half a
  correction; add the command that works now.
- State symptoms for failure modes: "hangs on splash screen forever" beats
  "requires setup".
- Correct every copy. The same stale fact usually lives in the README, the agent
  doc, and the editor rules — grep the claim across all of them.
- Keep agent docs terse. They are loaded into every session; prose costs tokens
  on every turn. One line per fact.
- Fix outright errors you pass through (wrong filenames, wrong `cd` targets,
  typos in headings) — they're cheap and they mislead.
- Respect the repo's formatter: run its markdown formatter/check on files you
  touched. Note that Prettier has no parser for `.mdc` — that's expected.

## 5. Report

List what you changed, grouped by severity of the staleness — what would have
broken an agent first. Per item: the wrong claim, the truth, the file. Then list
what you newly promoted into the agent docs, and any out-of-scope problems found.
Say explicitly what you verified and found already correct, so the user knows the
audit's coverage rather than just its hits.

Do not commit unless asked.
