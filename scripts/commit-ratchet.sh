#!/usr/bin/env bash
# commit-ratchet.sh <sha> [<herdr pane>] — the ratchet on one commit's own tree (not the shared working tree), run
# detached by .githooks/post-commit (SF74 W18, speed audit #3). It used to run inside the hook and block every src
# commit 24-70 s for an advisory answer that the push-time regeneration and the gate measure again minutes later.
#
#   - single instance (.git/commit-ratchet.lock): a commit made while one runs is skipped (logged); the push measures
#     every commit anyway and refuses a rise.
#   - result: .git/ratchet-last.txt (the last run's sha, verdict and output); one line per run in .git/commit-ratchet.log.
#   - a rise types one line into the committing pane through herdr (when the commit came from one).
set -uo pipefail
sha="${1:?usage: commit-ratchet.sh <sha> [<pane>]}"
pane="${2:-}"
repo="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
common="$(git -C "$repo" rev-parse --path-format=absolute --git-common-dir)"
log="$common/commit-ratchet.log"
note() { printf '%s %s %s\n' "$(date '+%F %T')" "${sha:0:9}" "$*" >> "$log"; }

if [ "${COMMIT_RATCHET_LOCKED:-}" != 1 ]; then
  COMMIT_RATCHET_LOCKED=1 lockf -k -t 0 "$common/commit-ratchet.lock" bash "$0" "$@"
  [ "$?" -eq 75 ] && note "skipped: another commit's ratchet is running (the push measures this one)"
  exit 0
fi

# the ratchet reads both oxlint configs and (since E362 AG16/17) scripts/guard-counts.mjs; archive only what the commit has
paths="src lint .oxlintrc.ratchet.json package.json"
for extra in .oxlintrc.json scripts/guard-counts.mjs scripts/legacy-shards.mjs; do git -C "$repo" cat-file -e "$sha:$extra" 2>/dev/null && paths="$paths $extra"; done
tmp="$(cd "$(mktemp -d /tmp/ratchet-commit.XXXXXX)" && pwd -P)" || exit 0 # canonical: /tmp is a symlink on macOS (E432)
trap 'rm -rf "$tmp"' EXIT
t0=$SECONDS
# shellcheck disable=SC2086 # word-split on purpose: a list of literal paths
git -C "$repo" archive "$sha" -- $paths | tar -x -C "$tmp" 2>/dev/null
node "$repo/scripts/link-node-modules.mjs" "$repo" "$tmp" # E432: @wildshard/* resolve to this export, not the working tree
if out="$(cd "$tmp" && node lint/ratchet.mjs 2>&1)"; then
  printf '%s ok\n%s\n' "$sha" "$out" > "$common/ratchet-last.txt"
  note "ok in $((SECONDS - t0)) s"
  exit 0
fi
printf '%s ROSE\n%s\n' "$sha" "$out" > "$common/ratchet-last.txt"
note "ROSE in $((SECONDS - t0)) s"
if [ -n "$pane" ] && command -v herdr >/dev/null 2>&1; then
  rows="$(echo "$out" | grep -E "was|rose" | head -4 | cut -c1-200 | tr '\n' ' ')"
  herdr agent prompt "$pane" "[commit-ratchet] the ratchet ROSE in your commit ${sha:0:9}; it blocks every push, fix it now. $rows (full output: .git/ratchet-last.txt)" >/dev/null 2>&1 || true
fi
exit 0
