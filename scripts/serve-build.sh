#!/usr/bin/env bash
# serve-build.sh — build the game and serve that build: the ONLY way to run it locally (E317, Jake 2026-09-29: "Vite dev
# sucks. No one should be using Vite dev … a combination of vite build and vite start"). No `vite` dev servers.
#
#   scripts/serve-build.sh [--head | --rev <rev>] [--port <n>] [--hours <h>] [--name <label>] [--devserver]
#        vite build → a private out dir → `vite preview` on a free port (4400–4999), detached. Prints the URL.
#        --head   build a clean `git archive HEAD` export instead of the working tree (nobody's WIP in it)
#        --rev    the same for any commit (a before / after pair, e.g. scripts/nine-sim-memory.mjs --rev=f9ca6490)
#        --hours  the server is reaped after this long (default 4; `scripts/browser-lane.sh reap`)
#   scripts/serve-build.sh list                  the servers this script started, their age and expiry
#   scripts/serve-build.sh stop <port|all-mine>  stop one (all-mine: every server this Claude session started)
#
# public/ (≈ 500 MB) is not copied: the out dir symlinks its top-level entries, so a build takes the JS build's time only.
# Registry: ~/.dev-servers/<port> ("pid expiry outdir owner name"; owner = the session id, E338). Reaped by `scripts/browser-lane.sh reap` (hooks on
# SessionStart / Stop / SubagentStop): an expired registered preview, an unregistered `vite preview` older than 6 h, and
# every `vite` dev server older than 2 h.

set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
REG="${SERVE_REG_DIR:-$HOME/.dev-servers}"; mkdir -p "$REG"
# "mine" is the calling session, not its folder (E338): every agent runs from the repo root or a shared scratchpad, so a
# cwd key let one agent's all-mine / eviction stop another's preview mid-run. Claude Code sets CLAUDE_CODE_SESSION_ID;
# anything else falls back to the folder.
CALLER="${CLAUDE_CODE_SESSION_ID:-${CODEX_SESSION_ID:-$PWD}}"; CALLER="${CALLER// /_}"
BASE="${SERVE_BUILD_DIR:-/private/tmp/wildshard-serve}"; mkdir -p "$BASE"; BASE="$(cd "$BASE" && pwd -P)" # canonical (E432)

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
        # New previews have PID == PGID. Retire their whole session, including pnpm/vite descendants.
        # Older registered previews share their launcher's group, so retain the legacy PID-only cleanup there.
        if [ "$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ')" = "$pid" ]; then
          kill -TERM -- "-$pid" 2>/dev/null
          sleep 2
          kill -KILL -- "-$pid" 2>/dev/null
        else
          pkill -TERM -P "$pid" 2>/dev/null; kill -TERM "$pid" 2>/dev/null
        fi
        rm -f "$f"
        # delete the build now (~1.5 GB each): kept as .stopped-* they filled the disk (221 GB, 2026-10-02)
        [ -n "$out" ] && [ -d "$out" ] && [[ "$out" == /private/tmp/?*/?* ]] && { rm -rf "$out" & } 2>/dev/null
        echo "stopped :$(basename "$f")"
      fi
    done
    exit 0;;
esac

MODE=production; HEAD_ONLY=0; REV=HEAD; PORT=""; HOURS=4; NAME="build"
while [ $# -gt 0 ]; do
  case "$1" in
    --devserver) MODE=devserver; shift;;
    --head) HEAD_ONLY=1; shift;;
    --rev) HEAD_ONLY=1; REV="$2"; shift 2;;
    --port) PORT="$2"; shift 2;;
    --hours) HOURS="$2"; shift 2;;
    --name) NAME="$2"; shift 2;;
    *) echo "serve-build.sh: unknown option $1" >&2; exit 64;;
  esac
done

# caps (E317 follow-up: one session held 26 previews registered for 8–12 h): --hours at most SERVE_MAX_HOURS (4), and at
# most SERVE_MAX_LIVE (12) previews machine-wide. Over it: this caller's own oldest preview is stopped to make room; else
# another's, but only one older than SERVE_RECYCLE_MIN (60) minutes — a preview someone is capturing on right now is never
# pulled (E339: the old any-preview recycling stopped agents' servers mid-capture); else it waits for room.
# The port is picked and reserved under a lock (a placeholder registry entry, this shell's pid, until the preview's own
# pid replaces it): two starts in the same second were both handed :4400 (E339).
MAX_H="${SERVE_MAX_HOURS:-4}"; MAX_LIVE="${SERVE_MAX_LIVE:-12}"; RECYCLE_MIN="${SERVE_RECYCLE_MIN:-60}"
if ! [[ "$HOURS" =~ ^[0-9]+$ ]] || [ "$HOURS" -lt 1 ]; then HOURS=1; fi
if [ "$HOURS" -gt "$MAX_H" ]; then echo "serve-build: --hours capped at $MAX_H" >&2; HOURS=$MAX_H; fi
age_min() {  # minutes since pid started (ps etime [[dd-]hh:]mm:ss)
  local e d=0 h=0 m=0; e="$(ps -o etime= -p "$1" 2>/dev/null | tr -d ' ')"; [ -z "$e" ] && { echo 0; return; }
  if [[ "$e" == *-* ]]; then d="${e%%-*}"; e="${e#*-}"; fi
  IFS=: read -r -a t <<<"$e"
  case "${#t[@]}" in 3) h=${t[0]}; m=${t[1]};; 2) m=${t[0]};; esac
  echo $(( 10#$d * 1440 + 10#$h * 60 + 10#$m ))
}
lock() {  # a mkdir lock round the registry; a lock left by a killed start is broken after 60 s
  local n=0
  until mkdir "$REG/.lock" 2>/dev/null; do
    n=$((n + 1)); [ $n -gt 300 ] && { rmdir "$REG/.lock" 2>/dev/null; n=0; }
    sleep 0.2
  done
}
unlock() { rmdir "$REG/.lock" 2>/dev/null; return 0; }
said=0
while :; do
  lock
  n_live=0; mine=""; mine_exp=""; other=""; other_age=0
  for f in "$REG"/*; do
    [ -f "$f" ] || continue
    read -r pid exp out cwd name < "$f"
    kill -0 "$pid" 2>/dev/null || { rm -f "$f"; continue; }
    n_live=$((n_live + 1))
    if [ "$cwd" = "$CALLER" ]; then
      if [ -z "$mine_exp" ] || [ "$exp" -lt "$mine_exp" ]; then mine="$(basename "$f")"; mine_exp="$exp"; fi
    else
      a="$(age_min "$pid")"; if [ "$a" -gt "$other_age" ]; then other="$(basename "$f")"; other_age="$a"; fi
    fi
  done
  if [ "$n_live" -lt "$MAX_LIVE" ]; then
    if [ -z "$PORT" ]; then
      for p in $(seq 4400 4999); do
        [ -f "$REG/$p" ] && continue
        lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1 && continue
        PORT=$p; break
      done
    fi
    # reserve it: this shell holds the entry until the preview's pid replaces it (an exit before that drops it)
    stamp="$(date +%Y%m%d-%H%M%S)-$PORT"
    [ -n "$PORT" ] && { echo "$$ $(( $(date +%s) + 3600 )) $BASE/$stamp $CALLER $NAME(building)" > "$REG/$PORT"; trap '[ -f "$REG/$PORT" ] && grep -q "^$$ " "$REG/$PORT" && rm -f "$REG/$PORT"' EXIT; }
    unlock; break
  fi
  unlock
  if [ -n "$mine" ]; then
    echo "serve-build: $MAX_LIVE previews running — stopping your oldest, :$mine" >&2; bash "$0" stop "$mine" >/dev/null
  elif [ -n "$other" ] && [ "$other_age" -ge "$RECYCLE_MIN" ]; then
    echo "serve-build: $MAX_LIVE previews running — stopping :$other (up ${other_age} min)" >&2; bash "$0" stop "$other" >/dev/null
  else
    [ $said -eq 0 ] && { echo "serve-build: $MAX_LIVE previews running, all young and none yours — waiting (scripts/serve-build.sh list)" >&2; said=1; }
    sleep 15
  fi
done
[ -n "$PORT" ] || { echo "serve-build.sh: no free port in 4400–4999" >&2; exit 1; }

OUT="$BASE/$stamp/dist"
SRC="$REPO"
if [ $HEAD_ONLY -eq 1 ]; then
  SRC="$BASE/$stamp/src"; mkdir -p "$SRC"
  git -C "$REPO" archive "$REV" | tar -x -C "$SRC" || { echo "serve-build.sh: cannot export $REV" >&2; exit 1; }
  # an export has no .git: hand vite.config.ts the commit, so the build id in version.json names it
  export VERCEL_GIT_COMMIT_SHA="$(git -C "$REPO" rev-parse "$REV")"
  node "$REPO/scripts/link-node-modules.mjs" "$REPO" "$SRC" # E432: @wildshard/* → this export, not the working tree
fi
mkdir -p "$BASE/$stamp"
echo "serve-build: building $( [ $HEAD_ONLY -eq 1 ] && echo "$REV $(git -C "$REPO" rev-parse --short "$REV")" || echo "the working tree" ) → $OUT" >&2
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
# the generated files first, as CI's `pnpm build` does: without them a new asset (round 13: Sky Reach's LUT) had no
# bytes.generated entry, the build skipped it, and every capture scored a game the deploy doesn't ship (E399)
( cd "$SRC" && python3 "$REPO/scripts/heavy-lane.py" build -- bash -c \
  'node scripts/gen.mjs && node scripts/build-shardfiles.mjs && pnpm exec vite build --mode "$1" --config "$2"' bash "$MODE" "$CFG" ) > "$BASE/$stamp/build.log" 2>&1 \
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
# A tool runner retires its process group when the calling command exits. nohup ignores HUP, but stays in that
# group: the preview died and the lane reaper correctly deleted its registered export. Give it its own session.
pid="$(node --input-type=module - "$CFG" "$OUT" "$PORT" "$BASE/$stamp/preview.log" <<'PREVIEW_NODE'
import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
const [config, outDir, port, log] = process.argv.slice(2);
const fd = openSync(log, 'a');
const child = spawn('pnpm', ['exec', 'vite', 'preview', '--config', config, '--outDir', outDir, '--port', port, '--strictPort', '--host', '127.0.0.1'],
  { detached: true, stdio: ['ignore', fd, fd] });
child.once('error', error => { closeSync(fd); console.error(error); process.exitCode = 1; });
child.once('spawn', () => { closeSync(fd); console.log(child.pid); child.unref(); });
PREVIEW_NODE
)" || exit 1
for _ in $(seq 1 60); do curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done
echo "$pid $(( $(date +%s) + HOURS * 3600 )) $BASE/$stamp $CALLER $NAME" > "$REG/$PORT"
echo "http://127.0.0.1:$PORT/"
echo "serve-build: pid $pid, reaped in ${HOURS} h; stop it with: scripts/serve-build.sh stop $PORT" >&2
