#!/usr/bin/env bash
# mkexp.sh <dir>: a clean export of HEAD plus my lane's working copies (far-reach), node_modules symlinked, gen run.
set -e
REPO=/Users/raynos/projects/games/wildshard-singleplayer
D=$1
rm -rf "$D"; mkdir -p "$D"
cd "$REPO"
# only what builds (AGENTS.md, 2026-10-02): no art/ progress/ sources/ (3.4 GB -> ~0.7 GB)
git archive HEAD -- . ':!art' ':!progress' ':!sources' | tar -x -C "$D"
# my lane: copy working-tree versions (tracked + untracked) of far-reach source, tests and assets
rsync -a src/shards/far-reach/ "$D/src/shards/far-reach/" --delete
rsync -a test/shards/far-reach/ "$D/test/shards/far-reach/" --delete
rsync -a public/assets/far-reach/ "$D/public/assets/far-reach/"
# files another agent is mid-way through (sr/pins.txt, one far-reach-relative path per line) go back to HEAD before gen
PINS="$(dirname "$0")/pins.txt"
if [ -f "$PINS" ]; then while read -r f; do [ -z "$f" ] && continue; if git cat-file -e "HEAD:src/shards/far-reach/$f" 2>/dev/null; then git show "HEAD:src/shards/far-reach/$f" | cat > "$D/src/shards/far-reach/$f"; else rm -f "$D/src/shards/far-reach/$f"; fi; done < "$PINS"; fi
ln -s "$REPO/node_modules" "$D/node_modules"
cd "$D" && node scripts/gen.mjs >/dev/null 2>&1 || node scripts/gen.mjs
echo "export ready: $D ($(git -C $REPO rev-parse --short HEAD))"
