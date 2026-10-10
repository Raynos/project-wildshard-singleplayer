#!/usr/bin/env bash
# push-main.sh — the one way to push main (the bare-`git push` block in .claude/hooks/guard-bash-safety.sh points here).
#
# Why: every agent shares one checkout and one local main, over a ~10–100 KB/s uplink. On 2026-09-22 (E19) six
# agents pushed the same ~12 MB at once and every push hung for 15+ minutes. So pushes take .git/push.lock
# (macOS lockf: released even if the push dies), and a held lock means LEAVE LOCAL, never wait: the push in flight
# re-checks origin/main..main before it lets go and pushes again, so it carries every commit that landed meanwhile.
# Pushed? `git log origin/main..main` is empty. Live? Check the next hourly deploy and
# https://wildshard-singleplayer.vercel.app/version.json (or dispatch the workflow now).
#
# Normally nobody runs it by hand: .githooks/post-commit starts scripts/auto-push.sh, which runs it (SF74 W14).
#
#   scripts/push-main.sh
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

if [ "${1:-}" != "--locked" ]; then
  # Run the locked loop from a private snapshot: bash reads a script as it goes, so an edit landing in the shared tree
  # mid-push must not change the running pusher (the gate snapshots itself the same way).
  snap="$(mktemp -t push-main)" && cp "$0" "$snap" || exit 1
  # PUSH_WAIT=1 (scripts/auto-push.sh): queue behind the push in flight (up to 30 min) instead of leaving commits local.
  if [ "${PUSH_WAIT:-}" = 1 ]; then lockf -k -t 1800 .git/push.lock bash "$snap" --locked; else lockf -k -t 0 .git/push.lock bash "$snap" --locked; fi
  rc=$?
  rm -f "$snap"
  if [ "$rc" -eq 75 ]; then # EX_TEMPFAIL: another push holds the lock
    echo "push-main: a push is in flight — leaving your commits LOCAL; it pushes again before it releases, so it carries them."
    echo "           check later: git log origin/main..main (empty = shipped)"
    exit 0
  fi
  exit "$rc"
fi

tipfile="$(git rev-parse --path-format=absolute --git-common-dir)/push-main.tip"
# SF74 W14: one JSON line per loop (regeneration seconds, gate + upload seconds) in .git/push-timings.jsonl.
timings="$(git rev-parse --path-format=absolute --git-common-dir)/push-timings.jsonl"
record() { printf '{"at":%s,"tip":"%s","ahead":%s,"regen":%s,"push":%s,"rc":%s}\n' "$(date +%s)" "$1" "$2" "$3" "$4" "$5" >> "$timings" 2>/dev/null || true; }
# SF74 W25 (speed audit #11): a red tip still lets the commits before the break through.
# try_prefix <vitest|witness> <red tip> <output file>: scripts/green-prefix.mjs bisects the red (the failing test files of
# a gate, or a refused witness payload of the regeneration) over the unpushed commits and names the newest pushable
# commit before the break; gate it and push it when green (twice at most: a prefix's own gate can name other files).
# GREEN_PREFIX=0 turns it off. The caller still exits red, so auto-push pings the lane of the first bad commit.
try_prefix() {
  local mode="$1" red_tip="$2" out="$3" prefix prc pahead t1 flag=()
  [ "$mode" = witness ] && flag=(--witness)
  for _p in 1 2; do
    [ "${GREEN_PREFIX:-1}" != 0 ] && [ -f scripts/green-prefix.mjs ] || return 0
    prefix="$(node scripts/green-prefix.mjs ${flag[@]+"${flag[@]}"} "$red_tip" "$out")"
    [ -n "$prefix" ] || return 0
    t1=$SECONDS
    bash scripts/vercel-tree-gate.sh "$prefix" > "$out" 2>&1; prc=$?
    sed 's/^/  prefix: /' "$out"
    if [ "$prc" = 0 ]; then
      pahead="$(git rev-list --count "origin/main..$prefix")"
      echo "push-main: pushing green prefix $(git rev-parse --short "$prefix") ($pahead of $(git rev-list --count "origin/main..main") commits); the rest stays red"
      git push origin "$prefix:refs/heads/main"; prc=$?
      record "$prefix" "$pahead" 0 "$((SECONDS - t1))" "$prc"
      [ "$prc" = 0 ] && echo "push-main: green prefix pushed: origin/main = $(git rev-parse --short "$prefix")"
      return 0
    fi
    red_tip="$prefix"; flag=() # the prefix's own gate went red: bisect its failing files below it
  done
}
for _ in 1 2 3 4 5 6; do
  # SF6b: one clean committed export and private-index regeneration while this pusher holds the lock.
  # Increases require GENERATED_APPROVAL_FILE with the coordinator's exact reviewed receipt.
  t0=$SECONDS
  rout="$(mktemp -t push-regen)"
  REGEN_SHA_FILE="$tipfile" node scripts/regenerate-committed.mjs 2>&1 | tee "$rout"; rc=${PIPESTATUS[0]}
  if [ "$rc" != 0 ]; then
    record '' 0 "$((SECONDS - t0))" 0 "$rc"
    grep -q 'witness-manifests: payloads changed' "$rout" && try_prefix witness "$(git rev-parse main)" "$rout"
    rm -f "$rout"; exit "$rc"
  fi
  rm -f "$rout"
  regen=$((SECONDS - t0))
  # Push exactly the regenerated tip: a builder commit landing after the regeneration waits for the next loop, so the
  # gate never sees an unregenerated tip (2026-10-09: 'Ratchet rose: … is clean' reds after a lane cleaned debt).
  tip="$(cat "$tipfile")"
  ahead="$(git rev-list --count "origin/main..$tip")"
  if [ "$ahead" = 0 ]; then
    [ "$(git rev-list --count origin/main..main)" = 0 ] || continue
    echo "push-main: origin/main has every local commit ($(git rev-parse --short main))"
    exit 0
  fi
  t0=$SECONDS
  # SF74 W20 (speed audit #5): gate first, push after. The pre-push hook then finds the gate's stamp and returns at
  # once, so GitHub's SSH session never idles through a 6-minute gate (2026-10-09: "Connection to github.com closed by
  # remote host" after a 385 s gate, and the whole gate ran again).
  if [ "${SKIP_VERCEL_GATE:-}" != 1 ]; then
    gout="$(mktemp -t push-gate)"
    bash scripts/vercel-tree-gate.sh "$tip" 2>&1 | tee "$gout"; rc=${PIPESTATUS[0]}
    if [ "$rc" != 0 ]; then
      record "$tip" "$ahead" "$regen" "$((SECONDS - t0))" "$rc"
      try_prefix vitest "$tip" "$gout"
      rm -f "$gout"
      exit "$rc"
    fi
    rm -f "$gout"
  fi
  echo "push-main: pushing $ahead commit(s) to origin main ($(git rev-parse --short "$tip")) …"
  git push origin "$tip:refs/heads/main"; rc=$?
  record "$tip" "$ahead" "$regen" "$((SECONDS - t0))" "$rc"
  [ "$rc" = 0 ] || exit "$rc"
done
echo "push-main: still commits left after 6 pushes — run it again" >&2
exit 75 # pushed, but more landed meanwhile: auto-push.sh goes again rather than calling it red
