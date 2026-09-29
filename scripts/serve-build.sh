#!/usr/bin/env bash
# serve-build.sh — build the game and serve that build: the ONLY way to run it locally (E317, Jake 2026-09-29: "Vite dev
# sucks. No one should be using Vite dev … a combination of vite build and vite start"). No `vite` dev servers.
#
#   scripts/serve-build.sh [--head] [--port <n>] [--hours <h>] [--name <label>]
#        vite build → a private out dir → `vite preview` on a free port (4400–4999), detached. Prints the URL.
#        --head   build a clean `git archive HEAD` export instead of the working tree (nobody's WIP in it)
#        --hours  the server is reaped after this long (default 4; `scripts/browser-lane.sh reap`)
#   scripts/serve-build.sh list                  the servers this script started, their age and expiry
#   scripts/serve-build.sh stop <port|all-mine>  stop one (all-mine: every server started from this shell's session dir)
#
# public/ (≈ 500 MB) is not copied: the out dir symlinks its top-level entries, so a build takes the JS build's time only.
# Registry: ~/.dev-servers/<port> ("pid expiry outdir cwd name"). Reaped by `scripts/browser-lane.sh reap` (hooks on
# SessionStart / Stop / SubagentStop): an expired registered preview, an unregistered `vite preview` older than 6 h, and
# every `vite` dev server older than 2 h.

set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
REG="$HOME/.dev-servers"; mkdir -p "$REG"
CALLER="$PWD"
BASE="${SERVE_BUILD_DIR:-/private/tmp/wildshard-serve}"; mkdir -p "$BASE"

case "${1:-}" in
  list)
    for f in "$REG"/*; do
      [ -f "$f" ] || continue
      read -r pid exp out cwd name < "$f"
      if ! kill -0 "$pid" 2>/dev/null; then rm -f "$f"; continue; fi
      printf '  http://127.0.0.1:%-5s pid %-6s %4s min left  %s  (%s)\n' "$(basename "$f")" "$pid" "$(( (exp - $(date +%s)) / 60 ))" "$name" "$out"
    done
    exit 0;;
  stop)
    tgt="${2:?stop <port|all-mine>}"
    for f in "$REG"/*; do
      [ -f "$f" ] || continue
      read -r pid exp out cwd name < "$f"
      if [ "$tgt" = "$(basename "$f")" ] || { [ "$tgt" = "all-mine" ] && [ "$cwd" = "$CALLER" ]; }; then
        pkill -TERM -P "$pid" 2>/dev/null; kill -TERM "$pid" 2>/dev/null; rm -f "$f"
        [ -n "$out" ] && [ -d "$out" ] && mv "$out" "$out.stopped-$(date +%s)" 2>/dev/null
        echo "stopped :$(basename "$f")"
      fi
    done
    exit 0;;
esac

HEAD_ONLY=0; PORT=""; HOURS=4; NAME="build"
while [ $# -gt 0 ]; do
  case "$1" in
    --head) HEAD_ONLY=1; shift;;
    --port) PORT="$2"; shift 2;;
    --hours) HOURS="$2"; shift 2;;
    --name) NAME="$2"; shift 2;;
    *) echo "serve-build.sh: unknown option $1" >&2; exit 64;;
  esac
done

if [ -z "$PORT" ]; then
  for p in $(seq 4400 4999); do
    [ -f "$REG/$p" ] && continue
    lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1 && continue
    PORT=$p; break
  done
fi
[ -n "$PORT" ] || { echo "serve-build.sh: no free port in 4400–4999" >&2; exit 1; }

stamp="$(date +%Y%m%d-%H%M%S)-$PORT"
OUT="$BASE/$stamp/dist"
SRC="$REPO"
if [ $HEAD_ONLY -eq 1 ]; then
  SRC="$BASE/$stamp/src"; mkdir -p "$SRC"
  git -C "$REPO" archive HEAD | tar -x -C "$SRC"
  ln -s "$REPO/node_modules" "$SRC/node_modules"
fi
mkdir -p "$BASE/$stamp"
echo "serve-build: building $( [ $HEAD_ONLY -eq 1 ] && echo "HEAD $(git -C "$REPO" rev-parse --short HEAD)" || echo "the working tree" ) → $OUT" >&2
# the repo's own config, with public/ left out of the copy (it is symlinked below)
CFG="$BASE/$stamp/vite.serve.mjs"
cat > "$CFG" <<JS
import { mergeConfig } from '$REPO/node_modules/vite/dist/node/index.js';
import base from '$SRC/vite.config.ts';
export default async (env) => {
  const b = typeof base === 'function' ? await base(env) : base;
  return mergeConfig(b, { root: '$SRC', build: { outDir: '$OUT', emptyOutDir: true, copyPublicDir: false } });
};
JS
( cd "$SRC" && pnpm exec vite build --config "$CFG" ) > "$BASE/$stamp/build.log" 2>&1 \
  || { tail -30 "$BASE/$stamp/build.log" >&2; exit 1; }
# public/ by symlink (vite preview follows them): an entry the build didn't write is linked whole; a folder both have
# (assets/: the build's JS chunks + public's models) is merged one level down, recursively; a file the build wrote wins
link_tree() {
  local src="$1" dst="$2" e n
  for e in "$src"/* "$src"/.[!.]*; do
    [ -e "$e" ] || continue
    n="$dst/$(basename "$e")"
    if [ ! -e "$n" ]; then ln -s "$e" "$n"
    elif [ -d "$e" ] && [ -d "$n" ] && [ ! -L "$n" ]; then link_tree "$e" "$n"; fi
  done
}
link_tree "$SRC/public" "$OUT"

cd "$SRC" || exit 1
nohup pnpm exec vite preview --config "$CFG" --outDir "$OUT" --port "$PORT" --strictPort --host 127.0.0.1 > "$BASE/$stamp/preview.log" 2>&1 &
pid=$!
for _ in $(seq 1 60); do curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done
echo "$pid $(( $(date +%s) + HOURS * 3600 )) $BASE/$stamp $CALLER $NAME" > "$REG/$PORT"
echo "http://127.0.0.1:$PORT/"
echo "serve-build: pid $pid, reaped in ${HOURS} h; stop it with: scripts/serve-build.sh stop $PORT" >&2
