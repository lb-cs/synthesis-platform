# Cursor Rules

These `.mdc` files are **stubs**. They exist only to give Cursor glob-scoped
auto-attachment — each carries frontmatter (`globs` / `alwaysApply`, `description`) and
an `@docs/rules/...` reference to the real content.

The rules themselves live in [`docs/rules/`](../../docs/rules/) as plain markdown, so
Cursor, Claude Code, and every other agent read the same source. `AGENTS.md` at the repo
root is the always-on entry point and Cursor reads it too.

**Edit rule content in `docs/rules/`, not here.** Touch a stub only when a glob or the
routing changes.

`dependency-selection.mdc` and `git-commits.mdc` are the exceptions: they are
`alwaysApply: true` and carry their own short copy, because they have to be in context
_before_ an agent reaches for a package or writes a commit rather than after. Keep them in
sync with `docs/rules/06-coding-standards.md`.

Note: Cursor ignores plain `.md` files inside `.cursor/rules/` — only `.mdc` is picked up.
That is why the stubs exist rather than symlinks. Prettier has no `.mdc` parser, so
`format:check` skips them.
