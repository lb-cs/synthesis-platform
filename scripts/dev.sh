#!/usr/bin/env bash
# npm run dev:all: Supabase, the worker, and the Next.js app in one terminal.
# Needs .env and worker/.env filled in (docs/local-setup.md). Ctrl+C stops the app and
# the worker; Supabase keeps running until `npx supabase stop`.
set -euo pipefail
cd "$(dirname "$0")/.."

npx --yes supabase status >/dev/null 2>&1 || npx --yes supabase start
npx --yes supabase migration up --local

uv run --directory worker python -m worker &
worker=$!
# Stop the worker with the app. It finishes the sources it already started.
trap 'kill "$worker" 2>/dev/null; wait "$worker"' EXIT

npm run dev
