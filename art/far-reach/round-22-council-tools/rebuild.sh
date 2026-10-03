#!/usr/bin/env bash
# rebuild.sh: refresh the export with my lane's working copies, stop the old preview, serve the new build. Prints the URL.
set -e
SP=/private/tmp/claude-501/-Users-raynos-projects-games-wildshard-singleplayer/e66e760a-bf2c-4571-8e15-573e0d987c23/scratchpad
REPO=/Users/raynos/projects/games/wildshard-singleplayer
"$SP/sr/mkexp.sh" "$SP/exp" >/dev/null
cd "$SP/exp"
npx tsc --noEmit
lint=$(npx oxlint src/shards/far-reach 2>&1) || true; echo "$lint" | tail -3
if echo "$lint" | grep -qE "^ *(x|×)|error (typescript|eslint|oxc|unicorn|import)"; then echo "LINT FAILED"; exit 1; fi
if [ -f "$SP/sr/port" ]; then bash scripts/serve-build.sh stop "$(cat "$SP/sr/port")" >/dev/null 2>&1 || true; fi
url=$(bash scripts/serve-build.sh --name sr4 --hours 6 2>&1 | grep -o 'http://127.0.0.1:[0-9]*/')
echo "${url%/}" | grep -o '[0-9]*$' > "$SP/sr/port"
echo "$url"
