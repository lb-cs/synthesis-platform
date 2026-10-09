# Local Development Setup Guide (Synthesis Platform)

Goal: go from a fresh computer to the app running at http://localhost:3000 with a local database.

Repo: https://github.com/lb-cs/synthesis-platform

## 1. Prerequisites

| Tool               | Version           | Check with               |
| ------------------ | ----------------- | ------------------------ |
| Git                | any recent        | `git --version`          |
| Node.js            | 24 (see `.nvmrc`) | `node --version`         |
| npm                | 11                | `npm --version`          |
| Docker Desktop     | running           | `docker --version`       |
| Supabase CLI       | see step 4        | `npx supabase --version` |
| VS Code (optional) | any               |                          |

Windows users: run every command in **Git Bash**, not PowerShell (PowerShell blocks `npm`
scripts with "running scripts is disabled"). Type commands by hand if pasting produces odd characters.

## 2. One-time Git setup

```
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

Without this, `git commit` fails because the author is unknown.

## 3. Clone the repo

Clone it somewhere that is **not** inside OneDrive/Dropbox/iCloud (for example `C:\Users\<you>\Projects`).
Synced folders lock files inside `.git` and cause errors.

```
cd ~/Projects
git clone https://github.com/lb-cs/synthesis-platform.git
cd synthesis-platform
```

## 4. Install dependencies and the Supabase CLI

```
npm ci
```

The README expects the Supabase CLI. If a global install is blocked on your machine, run it
through `npx` instead. It downloads the CLI on first use and changes no files in the repo:

```
npx supabase --version
```

## 5. Start the database (Docker must be running)

1. Open Docker Desktop and wait until it says it is running.
2. In the repo folder:

```
supabase start        # or: npx supabase start
```

The first run downloads images and takes a few minutes. When it finishes it applies
`supabase/migrations`. Useful local URLs:

- Supabase Studio (browse tables): http://127.0.0.1:54323
- Local email inbox (login codes arrive here): http://127.0.0.1:54324

## 6. Environment variables

```
cp .env.example .env
```

Then fill in the two values using the output of `supabase status`:

- `NEXT_PUBLIC_SUPABASE_URL` = the API URL (looks like http://127.0.0.1:54321)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = the publishable key (`sb_publishable_...`)

Note: `.env.example` says to copy to `.env.local`; the README says `.env`. Either works with Next.js.

## 7. Run the app

```
npm run dev
```

Open http://localhost:3000. To sign in, enter your email, then open the local inbox
(http://127.0.0.1:54324) to get the one-time code.

## 8. Before you open a PR

```
npm run format:check
npm run lint
npm run type-check
npm run build
```

Use `npm run format` / `npm run lint:fix` to auto-fix. Branch from main, never push to main directly.

## 9. Stopping

```
supabase stop         # or: npx supabase stop
```

## Troubleshooting

| Symptom                                                                | Fix                                                                                           |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| "running scripts is disabled" in PowerShell                            | Use Git Bash                                                                                  |
| `Your project's URL and Key are required to create a Supabase client!` | `.env` is missing or the two Supabase values are empty. Redo step 6 and restart `npm run dev` |
| `supabase start` fails / cannot connect to Docker                      | Start Docker Desktop and wait until it is fully running                                       |
| `supabase: command not found`                                          | Use `npx supabase ...` (step 4)                                                               |
| `git commit` says "Author identity unknown"                            | Do step 2                                                                                     |
| `unable to unlink` / `.git/objects` errors                             | Move the repo out of OneDrive (step 3)                                                        |
| Pasted commands show strange characters                                | Type the command by hand                                                                      |
| Login code never arrives                                               | Check the local inbox at http://127.0.0.1:54324, not your real email                          |
| Port already in use                                                    | Stop the other process or `supabase stop` then `supabase start`                               |
| Wrong Node version                                                     | Install Node 24 (`nvm use` reads `.nvmrc`)                                                    |

## Verification log

- [ ] Followed on a fresh clone by a teammate (not yet done)
