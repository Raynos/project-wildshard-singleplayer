#!/usr/bin/env bash
# push-main.sh — the one way to push main (the bare-`git push` block in .claude/hooks/guard-bash-safety.sh points here).
#
# Why: every agent shares one checkout and one local main, over a ~10–100 KB/s uplink. On 2026-09-22 (E19) six
# agents pushed the same ~12 MB at once and every push hung for 15+ minutes. So pushes take .git/push.lock
# (macOS lockf: released even if the push dies), and a held lock means LEAVE LOCAL, never wait: the push in flight
# re-checks origin/main..main before it lets go and pushes again, so it carries every commit that landed meanwhile.
# Shipped? `git log origin/main..main` is empty, then https://wildshard-singleplayer.vercel.app/version.json.
#
#   scripts/push-main.sh
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

if [ "${1:-}" != "--locked" ]; then
  lockf -k -t 0 .git/push.lock "$0" --locked
  rc=$?
  if [ "$rc" -eq 75 ]; then # EX_TEMPFAIL: another push holds the lock
    echo "push-main: a push is in flight — leaving your commits LOCAL; it pushes again before it releases, so it carries them."
    echo "           check later: git log origin/main..main (empty = shipped)"
    exit 0
  fi
  exit "$rc"
fi

for _ in 1 2 3 4 5 6; do
  ahead="$(git rev-list --count origin/main..main)"
  if [ "$ahead" = 0 ]; then
    echo "push-main: origin/main has every local commit ($(git rev-parse --short main))"
    exit 0
  fi
  echo "push-main: pushing $ahead commit(s) to origin main …"
  git push origin main || exit $?
done
echo "push-main: still commits left after 6 pushes — run it again" >&2
exit 1
