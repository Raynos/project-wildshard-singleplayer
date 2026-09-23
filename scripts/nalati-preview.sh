#!/usr/bin/env bash
# nalati-preview.sh — deploy the Nalati branch as a playable preview to its OWN Vercel project
# (https://nalati-grasslands.vercel.app/?chunk=nalati-grasslands). Never a git push, never the main project.
#
#   scripts/nalati-preview.sh
#
# A clean `git archive HEAD` export (nobody's uncommitted work ships) → tsc → vite build → drop the trailers and
# source maps → `vercel deploy --prod` from a folder named after the project. Vercel dedups files by hash, so only
# the new bytes upload. Scope: raynos-projects.
set -euo pipefail
REPO="$(git rev-parse --show-toplevel)"
WORK=/tmp/nalati-preview
mkdir -p "$WORK"
mv "$WORK" "/tmp/nalati-preview-old-$(date +%s)"  # move the last run aside (dcg: no rm -rf on variables)
mkdir -p /tmp/nalati-preview/src
git -C "$REPO" archive HEAD | tar -x -C /tmp/nalati-preview/src
ln -s "$REPO/node_modules" /tmp/nalati-preview/src/node_modules
cd /tmp/nalati-preview/src
npx tsc --noEmit
npx vite build >/tmp/nalati-preview/build.log 2>&1 || { tail -30 /tmp/nalati-preview/build.log; exit 1; }
rm -f dist/trailer-15.mp4 dist/trailer-30.mp4
find dist/assets -maxdepth 1 -name '*.map' -print0 | xargs -0 rm -f
cp vercel.json dist/
mv dist /tmp/nalati-preview/nalati-grasslands
cd /tmp/nalati-preview/nalati-grasslands
vercel deploy --prod --yes --scope raynos-projects 2>&1 | grep -E 'Aliased|Production|Error' || true
echo "preview: https://nalati-grasslands.vercel.app/?chunk=nalati-grasslands  (HEAD $(git -C "$REPO" rev-parse --short HEAD))"
