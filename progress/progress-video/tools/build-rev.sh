#!/usr/bin/env bash
# build-rev.sh <label> <sha> — export a commit (code + public only), install its own lockfile, vite build it.
set -euo pipefail
REPO=/Users/raynos/projects/games/wildshard-singleplayer
PV="${PV:-$(pwd)}"  # work dir: the exports land in $PV/<label>
L="$1"; SHA="$2"; D="$PV/$L"
rm -rf "$D"; mkdir -p "$D"
git -C "$REPO" archive "$SHA" -- . ':!progress' ':!art' ':!docs' ':!android' ':!ios' ':!sources' ':!project' | tar -x -C "$D"
cd "$D"
echo "[$L] install" ; CI=1 pnpm install --frozen-lockfile --prefer-offline --ignore-scripts 2>&1 | tail -3
export VERCEL_GIT_COMMIT_SHA="$(git -C "$REPO" rev-parse "$SHA")"
STEPS='pnpm exec vite build'
if [ -f scripts/gen.mjs ]; then STEPS='node scripts/gen.mjs && node scripts/build-shardfiles.mjs && pnpm exec vite build'; fi
echo "[$L] build: $STEPS"
python3 "$REPO/scripts/heavy-lane.py" build -- bash -c "$STEPS" 2>&1 | tail -15
ls -d dist && du -sh dist
