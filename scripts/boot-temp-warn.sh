#!/usr/bin/env bash
# boot-temp-warn.sh: a pre-commit warning (it never refuses a commit) for the two things that make a reboot hurt.
#   1. The folders macOS empties at boot before login (/private/tmp and $TMPDIR) hold over 500,000 files. On 2026-10-15
#      millions of leftover export files there held the laptop at the login progress bar for hours.
#   2. ./tmp/build-mirror holds a slot other than gate, commit and check (G429: no per-lane or per-agent copies).
# Counting takes seconds, so the hook prints the last count at once and starts a background recount when that count is
# over 10 minutes old. `scripts/boot-temp-warn.sh --top` lists the biggest folders by file count.
# Rules: docs/process/MACHINE.md "Disk and boot".
set -u
root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
stamp="$root/tmp/.boot-temp-count"
limit=500000
temp_dirs=(/private/tmp)
[ -n "${TMPDIR:-}" ] && [ -d "${TMPDIR}" ] && temp_dirs+=("${TMPDIR%/}")

count_files() { find "$1" -xdev 2>/dev/null | wc -l | tr -d ' '; }

case "${1:-}" in
  --count)
    total=0
    for d in "${temp_dirs[@]}"; do total=$((total + $(count_files "$d"))); done
    mkdir -p "$root/tmp"
    printf '%s %s\n' "$(date +%s)" "$total" > "$stamp.new.$$" && mv "$stamp.new.$$" "$stamp"
    exit 0 ;;
  --top)
    for d in "${temp_dirs[@]}"; do
      for sub in "$d"/*/; do [ -d "$sub" ] && printf '%s %s\n' "$(count_files "$sub")" "$sub"; done
    done | sort -rn | head -10
    exit 0 ;;
esac

at=0; files=0
[ -f "$stamp" ] && read -r at files < "$stamp"
if [ $(( $(date +%s) - ${at:-0} )) -gt 600 ]; then
  mkdir -p "$root/tmp" && printf '%s %s\n' "$(date +%s)" "${files:-0}" > "$stamp"
  nohup "$0" --count >/dev/null 2>&1 &
fi
if [ "${files:-0}" -gt "$limit" ]; then
  echo "boot-temp: WARNING ${files} files in /private/tmp + \$TMPDIR (over ${limit}); macOS deletes them all at boot before login." >&2
  echo "boot-temp: find the biggest with scripts/boot-temp-warn.sh --top and delete your own (docs/process/MACHINE.md)." >&2
fi
extra=""
if [ -d "$root/tmp/build-mirror" ]; then
  for slot in "$root"/tmp/build-mirror/*/; do
    name="$(basename "$slot")"
    case "$name" in gate|commit|check|*.lock) ;; *) extra="$extra $name" ;; esac
  done
fi
[ -n "$extra" ] && echo "boot-temp: WARNING build-mirror slots beyond gate/commit/check (G429):$extra; delete the ones no process holds." >&2
exit 0
