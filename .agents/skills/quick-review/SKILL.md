---
name: quick-review
description: Review the current working changes or a PR and report ONLY real bugs that must be fixed before production — a terse bullet list with location and fix, high-confidence findings only. Use when the user asks to review changes, review a diff, review a PR, or run quick-review.
user-invocable: true
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(git diff:*)
  - Bash(git diff)
  - Bash(git status:*)
  - Bash(git log:*)
  - Bash(git merge-base:*)
  - Bash(git branch:*)
  - Bash(git rev-parse:*)
  - Bash(gh pr view:*)
  - Bash(gh pr diff:*)
  - Bash(gh pr checks:*)
---

# /quick-review — Must-fix-only code review

Review the target changes and report **only real bugs that must be fixed before
this reaches production**. The user does not want praise, summaries, a
description of what the PR does, style notes, maybes, or "worth a look" items.
Output a short bullet list; each bullet is a defect you are confident about, with
a location and a fix.

## 1. Determine the target

- If the user passed a PR number or URL (e.g. `/quick-review 1234`), review that PR:
  `gh pr diff <n>` for the diff, `gh pr view <n>` for context. Read changed files
  in full when the diff alone is not enough to judge an issue.
- If the user passed `staged`, review `git diff --staged`.
- Otherwise (default), review the local working branch against its base:
  - `base=$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main)`
  - `git diff "$base"...HEAD` plus `git diff` (unstaged) and `git diff --staged`.
- If there are no changes, say so in one line and stop.

## 2. Analyze

Read the diff **and** enough surrounding code to judge each finding — do not
review hunks in isolation. Open changed files with Read when needed. Look for:

- **Correctness** — wrong logic or conditions, off-by-one, null/undefined,
  unhandled exceptions, broken async/await, race conditions.
- **Security** — injection, missing authz/authn, secrets in code, unsafe
  deserialization, SSRF, path traversal, PII leaks.
- **Data loss / corruption** — writes that clear or overwrite data they should
  not, missing transactions/rollbacks, leaked handles, unbounded loops.
- **Regressions** — existing callers or contracts broken by the change.
- **User-facing lies** — copy, docs, or success messages that contradict what the
  code actually does, when acting on them would cause harm.

## 3. The bar for reporting

Every bullet must pass all three:

1. **Confident.** You can name the concrete input or state that triggers it and
   what goes wrong. If you would have to say "might", "could", "consider", or
   "double-check" — drop it.
2. **Real in production.** A user, a job, or the data will actually hit it. Not a
   hypothetical, not a maintainability preference, not missing tests.
3. **Should block shipping.** If it were the only finding, you would still say
   "fix this first". Style, naming, dead props, commented-out code, unused
   imports, and "this could be cleaner" never qualify.

Never pad the list. Three bullets you are sure of beat ten you are not. Zero is a
valid answer.

## 4. Output format

No preamble, no headings, no severity tiers. If nothing passes the bar, output
exactly: `No issues found.`

Otherwise a flat list, most damaging first:

```
- **[file.ext:line]** What breaks and when, in one line.
  - Fix: concise fix. Short code snippet only if it makes the fix concrete.
```

Keep every bullet to one or two lines. Use `file:line` links so they are
clickable. If a finding lives in another repo, use a relative path from the
working directory.
