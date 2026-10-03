#!/usr/bin/env bash
# preview.sh <scratch dir> [name]: a clean export of HEAD plus the working copies of Sky Reach's own paths (src/shards/
# far-reach, test/shards/far-reach, public/assets/far-reach, public/assets/lut/far-reach.bin), node_modules symlinked,
# gen run (bytes.generated lists every asset, so a new file reaches the build), typecheck + lint of the shard, then a
# served build. Prints the URL; the port goes to <scratch dir>/port-<name>. A second run with the same name replaces it.
#   PINS="species/stormRoc.ts plugin.ts"  far-reach-relative files another agent is mid-way through: kept at HEAD
#   HEAD_ONLY=1                            HEAD only, no working copies (the capture of what ships)
# Capture with views.mjs (next to this file) through scripts/browser-lane.sh.
set -e
REPO=/Users/raynos/projects/games/wildshard-singleplayer
SCR=${1:?scratch dir}; N=${2:-a}; D="$SCR/exp-$N"
rm -rf "$D"; mkdir -p "$D"
cd "$REPO"
git archive HEAD -- . ':!art' ':!progress' ':!sources' | tar -x -C "$D"
if [ -z "${HEAD_ONLY:-}" ]; then
  rsync -a --delete src/shards/far-reach/ "$D/src/shards/far-reach/"
  rsync -a --delete test/shards/far-reach/ "$D/test/shards/far-reach/"
  rsync -a public/assets/far-reach/ "$D/public/assets/far-reach/"
  [ -f public/assets/lut/far-reach.bin ] && cp public/assets/lut/far-reach.bin "$D/public/assets/lut/far-reach.bin"
  for f in ${PINS:-}; do
    if git cat-file -e "HEAD:src/shards/far-reach/$f" 2>/dev/null; then git show "HEAD:src/shards/far-reach/$f" | cat > "$D/src/shards/far-reach/$f"; else rm -f "$D/src/shards/far-reach/$f"; fi
  done
fi
ln -s "$REPO/node_modules" "$D/node_modules"
cd "$D"
node scripts/gen.mjs >/dev/null 2>&1 || node scripts/gen.mjs
npx tsc --noEmit
lint=$(npx oxlint src/shards/far-reach 2>&1) || true
if echo "$lint" | grep -qE "^ *(x|×)|error (typescript|eslint|oxc|unicorn|import)"; then echo "$lint" | tail -20; echo "LINT FAILED"; exit 1; fi
if [ -f "$SCR/port-$N" ]; then bash scripts/serve-build.sh stop "$(cat "$SCR/port-$N")" >/dev/null 2>&1 || true; fi
url=$(bash scripts/serve-build.sh --name "far-$N" --hours 6 2>&1 | grep -o 'http://127.0.0.1:[0-9]*/')
echo "${url%/}" | grep -o '[0-9]*$' > "$SCR/port-$N"
# serve-build prints the URL before the server answers: wait for it (a capture started at once fails to navigate)
for _ in $(seq 1 60); do curl -s -m 2 -o /dev/null "${url}version.json" && break; sleep 0.5; done
echo "$url"
