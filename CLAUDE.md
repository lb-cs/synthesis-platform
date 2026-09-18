# CLAUDE.md

Guidance for Claude Code when working in this repository.

The project rules are tool-agnostic and live in `AGENTS.md` + `docs/rules/`. Read them:

@AGENTS.md

## Claude Code specifics

### Layout

Everything agentic lives at the **repo root**: `.agents/skills/` holds the skill sources
and `.claude/skills/` symlinks to them, so there is one copy to edit. There is no
committed `.claude/settings.json`; per-developer settings go in
`.claude/settings.local.json`, which is gitignored.

### Skills

This repo ships its own skills in `.claude/skills/`, available as slash commands:

| Skill           | Use                                                                  |
| --------------- | -------------------------------------------------------------------- |
| `/grill-me`     | Relentless one-question-at-a-time interview to sharpen a plan        |
| `/quick-review` | Must-fix-only review of the working changes or a PR                  |
| `/tdd`          | Test-first feature work and bug fixes (red-green-refactor)           |
| `/implement`    | Work a spec through to an implementation                             |
| `/to-spec`      | Turn the current conversation into a spec on the issue tracker       |
| `/refresh-docs` | Audit docs and agent instructions against the code, fix what drifted |

`/refresh-docs` is the one to run when `AGENTS.md` or `docs/rules/` drifts from the code.
`/tdd` and `/implement` assume a test runner; until one lands (see
`docs/rules/05-testing.md`), they can only drive typecheck and lint.

### Things this repo will not do for you

Running the dev server, building, and anything that ships are the developer's call, not
part of "finishing" a change. Finish the edit, say what to run, and stop.

Local verification that is always fine: `npm run lint`, `npm run format:check`,
`npm run type-check`, and reading anything.
