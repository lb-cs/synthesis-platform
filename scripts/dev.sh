#!/usr/bin/env bash
# Runs the whole stack locally: Supabase, the worker, and the Next.js app.
#   npm run dev:all
# The app and the worker both get their Supabase URL and keys from the local stack, so an
# upload always reaches the worker, whatever .env says. Ctrl+C stops the app and the
# worker. Supabase keeps running so the next start is quick: `npx supabase stop` ends it.
set -euo pipefail

cd "$(dirname "$0")/.."

# The installed Supabase CLI if there is one, otherwise the npm package the docs use.
supabase() {
  if type -P supabase >/dev/null; then
    command supabase "$@"
  else
    npx --yes supabase "$@"
  fi
}

if ! type -P uv >/dev/null; then
  echo 'dev: uv runs the worker and is not installed. See https://docs.astral.sh/uv/getting-started/installation/' >&2
  exit 1
fi

status=$(supabase status -o env 2>/dev/null || true)

if [[ "$status" != *API_URL=* ]]; then
  supabase start
  status=$(supabase status -o env)
fi

# `supabase start` applies migrations only to a new database; this catches an older one
# up. A failure is reported rather than fatal: the app still starts, and the worker logs
# which database function it is missing.
supabase migration up --local || echo 'dev: migrations were not applied, see the error above' >&2

# One value from `supabase status -o env`, whose lines look like KEY="value".
status_value() {
  sed -n "s/^$1=\"\(.*\)\"\$/\1/p" <<<"$status"
}

api_url=$(status_value API_URL)
publishable_key=$(status_value PUBLISHABLE_KEY)
secret_key=$(status_value SECRET_KEY)

# Real environment variables beat .env files in Next.js and in the worker.
export NEXT_PUBLIC_SUPABASE_URL="$api_url"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$publishable_key"
export SUPABASE_URL="$api_url"
export SUPABASE_SERVICE_ROLE_KEY="$secret_key"

uv run --directory worker python -m worker &
worker=$!

# Whatever ends the script, stop the worker and let it finish the sources it started.
stop_worker() {
  kill -TERM "$worker" 2>/dev/null || true
  wait "$worker" 2>/dev/null || true
}
trap stop_worker EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

npm run dev
