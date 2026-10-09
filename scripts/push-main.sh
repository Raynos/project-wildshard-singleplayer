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
#   scripts/push-main.sh
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

if [ "${1:-}" != "--locked" ]; then
  # Run the locked loop from a private snapshot: bash reads a script as it goes, so an edit landing in the shared tree
  # mid-push must not change the running pusher (the gate snapshots itself the same way).
  snap="$(mktemp -t push-main)" && cp "$0" "$snap" || exit 1
  lockf -k -t 0 .git/push.lock bash "$snap" --locked
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
for _ in 1 2 3 4 5 6; do
  # SF6b: one clean committed export and private-index regeneration while this pusher holds the lock.
  # Increases require GENERATED_APPROVAL_FILE with the coordinator's exact reviewed receipt.
  t0=$SECONDS
  REGEN_SHA_FILE="$tipfile" node scripts/regenerate-committed.mjs || { rc=$?; record '' 0 "$((SECONDS - t0))" 0 "$rc"; exit "$rc"; }
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
  echo "push-main: pushing $ahead commit(s) to origin main ($(git rev-parse --short "$tip")) …"
  t0=$SECONDS
  git push origin "$tip:refs/heads/main"; rc=$?
  record "$tip" "$ahead" "$regen" "$((SECONDS - t0))" "$rc"
  [ "$rc" = 0 ] || exit "$rc"
done
echo "push-main: still commits left after 6 pushes — run it again" >&2
exit 1
