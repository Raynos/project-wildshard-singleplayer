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
# The detached reader belongs to the checkout, never a lane's private index/worktree environment.
git_local_vars="$(git rev-parse --local-env-vars)" || exit 1
while IFS= read -r git_local_name; do unset "$git_local_name"; done <<< "$git_local_vars"
sha="${1:?usage: commit-ratchet.sh <sha> [<pane>]}"
pane="${2:-}"
repo="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
common="$(git -C "$repo" rev-parse --path-format=absolute --git-common-dir)"
log="$common/commit-ratchet.log"
note() { printf '%s %s %s\n' "$(date '+%F %T')" "${sha:0:9}" "$*" >> "$log"; }
refuse() {
  local reason="$1"
  printf '%s REFUSED\n%s\n' "$sha" "$reason" > "$common/ratchet-last.txt"
  note "REFUSED: $reason"
  if [ -n "$pane" ] && command -v herdr >/dev/null 2>&1; then
    "$repo/scripts/herdr-prompt.sh" "$pane" "[commit-ratchet] cannot measure committed ${sha:0:9}: $reason; no debt rise was measured (full output: .git/ratchet-last.txt)" >/dev/null 2>&1 || true
  fi
}

if [ "${COMMIT_RATCHET_LOCKED:-}" != 1 ]; then
  COMMIT_RATCHET_LOCKED=1 lockf -k -t 0 "$common/commit-ratchet.lock" bash "$0" "$@"
  [ "$?" -eq 75 ] && note "skipped: another commit's ratchet is running (the push measures this one)"
  exit 0
fi

# the ratchet reads both oxlint configs and (since E362 AG16/17) scripts/guard-counts.mjs; archive only what the commit has
paths="src lint .oxlintrc.ratchet.json package.json"
for extra in .oxlintrc.json scripts/guard-counts.mjs scripts/legacy-shards.mjs scripts/generation-jobs.json scripts/precommit-generated-data.mjs scripts/link-node-modules.mjs; do git -C "$repo" cat-file -e "$sha:$extra" 2>/dev/null && paths="$paths $extra"; done
tmp="$(cd "$(mktemp -d /tmp/ratchet-commit.XXXXXX)" && pwd -P)" || exit 0 # canonical: /tmp is a symlink on macOS (E432)
trap 'rm -rf "$tmp"' EXIT
t0=$SECONDS
# shellcheck disable=SC2086 # word-split on purpose: a list of literal paths
if ! git -C "$repo" archive "$sha" -- $paths | tar -x -C "$tmp" 2>/dev/null; then
  refuse "committed archive failed"; exit 0
fi
if ! node "$tmp/scripts/link-node-modules.mjs" "$repo" "$tmp"; then
  refuse "committed dependency linking failed"; exit 0
fi
# Source-only trees omit cached JSON. Use this commit's catalogue and helper, never unpinned working data.
if [ -f "$tmp/scripts/precommit-generated-data.mjs" ]; then
  if ! out="$(node "$tmp/scripts/precommit-generated-data.mjs" "$repo" "$tmp" 2>&1)"; then
    refuse "generated guard data unavailable before measurement: $out"
    exit 0
  fi
fi
# Historical helpers silently skipped missing files. Refuse their incomplete exports too.
if ! out="$(node --input-type=module - "$tmp" 2>&1 <<'JS'
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = process.argv[2], catalog = resolve(root, 'scripts/generation-jobs.json');
if (existsSync(catalog)) for (const job of JSON.parse(readFileSync(catalog, 'utf8')).jobs) {
  for (const path of Object.keys(job.buildOutputs ?? {})) {
    if (path.endsWith('.json') && !existsSync(resolve(root, path))) {
      throw new Error(`Missing pinned generated guard data: ${path} (job ${job.id ?? 'unnamed'}). Run pnpm gen before measuring source guards.`);
    }
  }
}
JS
)"; then refuse "generated guard data unavailable before measurement: $out"; exit 0; fi
# A detached older commit may still be running when this launcher changes in the shared checkout.
ratchet_arg=''
if grep -q -- '--defer-reductions' "$tmp/lint/ratchet.mjs"; then ratchet_arg='--defer-reductions'; fi
if out="$(cd "$tmp" && node lint/ratchet.mjs ${ratchet_arg:+"$ratchet_arg"} 2>&1)"; then
  printf '%s ok\n%s\n' "$sha" "$out" > "$common/ratchet-last.txt"
  note "ok in $((SECONDS - t0)) s"
  exit 0
fi
if printf '%s\n' "$out" | node "$repo/scripts/ratchet-advisory.mjs" "$tmp/.oxlintrc.json" "$common/generated-approval.json" >/dev/null 2>&1; then
  printf '%s APPROVED\n%s\n' "$sha" "$out" > "$common/ratchet-last.txt"
  note "APPROVED: exact coordinator receipt covers the measured debt; push regeneration still required"
  exit 0
fi
printf '%s ROSE\n%s\n' "$sha" "$out" > "$common/ratchet-last.txt"
note "ROSE in $((SECONDS - t0)) s"
if [ -n "$pane" ] && command -v herdr >/dev/null 2>&1; then
  rows="$(echo "$out" | grep -E "was|rose" | head -4 | cut -c1-200 | tr '\n' ' ')"
  "$repo/scripts/herdr-prompt.sh" "$pane" "[commit-ratchet] unapproved ratchet rise or guard failure in ${sha:0:9}; needs a source fix or exact coordinator receipt before push regeneration. $rows (full output: .git/ratchet-last.txt)" >/dev/null 2>&1 || true
fi
exit 0
