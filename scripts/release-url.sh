#!/usr/bin/env bash
# release-url.sh — a frozen, public, shareable URL for a tagged version: https://wildshard-v<x>-<y>-<z>.vercel.app
#
#   scripts/release-url.sh v0.3.0
#
# Its OWN Vercel project per version (wildshard-v0-3-0 …), deployed ONCE from a clean `git archive <tag>` build and never
# redeployed, so the link keeps showing that version while main moves on. Why not an alias on the main project: Vercel's
# deployment protection guards every URL except a project's own production domains, so an alias answers 302 → a login
# page for anyone but us. The main project (wildshard-singleplayer) and its settings are never touched. Scope: raynos-projects.
set -euo pipefail
TAG="${1:?usage: scripts/release-url.sh vX.Y.Z}"
REPO="$(git rev-parse --show-toplevel)"
SHA="$(git -C "$REPO" rev-parse --verify "$TAG^{commit}")"
NAME="wildshard-$(echo "$TAG" | tr '.' '-')"          # v0.3.0 → wildshard-v0-3-0
WORK="/tmp/wildshard-release/$NAME-$(date +%s)"
mkdir -p "$WORK/src"
git -C "$REPO" archive "$SHA" | tar -x -C "$WORK/src"
ln -s "$REPO/node_modules" "$WORK/src/node_modules"
cd "$WORK/src"
VERCEL_GIT_COMMIT_SHA="$SHA" npx vite build >"$WORK/build.log" 2>&1 || { tail -30 "$WORK/build.log"; exit 1; }
find dist/assets -maxdepth 1 -name '*.map' -print0 | xargs -0 rm -f
cp vercel.json dist/
mv dist "$WORK/$NAME"                                   # the folder name names the Vercel project
cd "$WORK/$NAME"
vercel deploy --prod --yes --scope raynos-projects 2>&1 | grep -E 'Aliased|Production|Error' || true
echo "release: https://$NAME.vercel.app  ($TAG = $(git -C "$REPO" rev-parse --short "$SHA"), build $(cat version.json))"
