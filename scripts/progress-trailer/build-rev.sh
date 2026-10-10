#!/usr/bin/env bash
# build-rev.sh <label> <sha> — export a historical commit (code + public/ only), install its own lockfile, build it
# through the machine-wide build lane. The export lands in $PV/<label> (PV defaults to the current directory: run it
# from a scratch dir) and the build in $PV/<label>/dist. PROGRESS-TRAILER §3.1 (E468); from v1's tools (E467).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
PV="${PV:-$(pwd)}"
L="$1"; SHA="$2"; D="$PV/$L"
rm -rf "$D"; mkdir -p "$D"
git -C "$REPO" archive "$SHA" -- . ':!progress' ':!art' ':!docs' ':!android' ':!ios' ':!sources' ':!project' | tar -x -C "$D"
cd "$D"
echo "[$L] install"; CI=1 pnpm install --frozen-lockfile --prefer-offline --ignore-scripts 2>&1 | tail -3
VERCEL_GIT_COMMIT_SHA="$(git -C "$REPO" rev-parse "$SHA")"
export VERCEL_GIT_COMMIT_SHA
echo "$VERCEL_GIT_COMMIT_SHA" > SHA
STEPS='pnpm exec vite build'
if [ -f scripts/gen.mjs ]; then STEPS='node scripts/gen.mjs && node scripts/build-shardfiles.mjs && pnpm exec vite build'; fi
echo "[$L] build: $STEPS"
python3 "$REPO/scripts/heavy-lane.py" build -- bash -c "$STEPS" 2>&1 | tail -4
cp SHA dist/SHA
du -sh dist
