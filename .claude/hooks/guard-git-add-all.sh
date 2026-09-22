#!/usr/bin/env bash
# PreToolUse(Bash) guard — force the shared-index-safe git workflow.
#
# Why: this repo is worked by MULTIPLE concurrent agents sharing ONE git index.
# Anything that snapshots that shared index — `git add -A/./-u`, `git commit -am`,
# or a BARE `git commit` — sweeps a co-agent's in-flight staged work into the wrong
# commit (kami-kakushi f84aff9 / 0e10d96, where this hook comes from; here: staged deletions and
# docs sat in the shared index across sessions, 2026-09-22). The only safe shape is a pathspec
# commit: `git commit -m "..." -- path/a path/b`, and `git add` only for NEW files.
#
# Contract: reads the PreToolUse JSON on stdin, inspects .tool_input.command, exits 2
# (blocking) with a stderr explanation, else 0 (allow). BLOCKS: git add -A/./-u/--all;
# git add of an already-TRACKED file (edits don't need staging); git commit -a/-am;
# and a bare `git commit` lacking an explicit `-- <pathspec>` (checked only within the
# commit segment, quotes stripped — a `--` in a sibling command or the message no
# longer false-allows). PASSES: pathspec commits, `git add <new-file>`, dirs/globs
# (may hold new files), `--amend`, mid-merge, status/diff/log. Escape: SKIP_SWEEPGUARD=1.

set -euo pipefail

cmd="$(jq -r '.tool_input.command // empty' 2>/dev/null || true)"
[ -z "$cmd" ] && exit 0

# SKIP_SWEEPGUARD=1 escapes the STAGING rules below (add/commit shape) —
# but every use lands in the committed ledger, so bypasses are visible in diffs,
# not buried in transcripts. (Destructive tree-wide ops are guard-bash-safety.sh's
# jurisdiction and have NO escape.) .githooks/post-commit auto-commits a dirty ledger.
if printf '%s' "$cmd" | grep -qE '(^|[;&|])[[:space:]]*([A-Za-z_][A-Za-z_0-9]*=[^[:space:]]*[[:space:]]+)*SKIP_SWEEPGUARD=1[[:space:]]'; then
  repo="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
  ledger="$repo/project/sweepguard-ledger.md"
  flat="$(printf '%s' "$cmd" | tr '\n' ' ' | tr '\`' "'" | cut -c1-200)"
  printf -- '- %s · %s · `%s`\n' "$(date '+%Y-%m-%d %H:%M')" "${HERDR_PANE_ID:-?}" "$flat" >> "$ledger" 2>/dev/null || true
  exit 0
fi

deny() {
  cat >&2 <<EOF
BLOCKED by .claude/hooks/guard-git-add-all.sh: "$1"

This repo shares ONE git index across concurrent agents. The safe workflow:

  • Editing a tracked file → DON'T stage it; commit it directly (pathspec form
    commits the working-tree copy, ignoring the shared index):
        git commit -m "..." -- path/to/file
  • Adding a NEW (untracked) file → stage just that file, then pathspec-commit:
        git add path/to/new-file
        git commit -m "..." -- path/to/new-file

Never: git add -A / . / -u, git commit -a, or a bare 'git commit' — they
snapshot the SHARED index and sweep a co-agent's staged work into your commit.
Deliberate, rare escape: SKIP_SWEEPGUARD=1.
EOF
  exit 2
}

deny_commit() {
  cat >&2 <<EOF
BLOCKED by .claude/hooks/guard-git-add-all.sh: bare 'git commit' (no ' -- <pathspec>')

This repo shares ONE git index across concurrent agents. A bare commit snapshots
that shared index — sweeping whatever a co-agent staged between your 'git add'
and now (kami-kakushi f84aff9 did exactly this). Commit with an explicit pathspec instead:

    git add path/a path/b          # new files only; edits don't even need it
    git commit -m "..." -- path/a path/b

The pathspec form commits ONLY those paths (git's --only semantics: a temporary
index from HEAD + the named paths) and leaves co-agents' staged work untouched.
Escapes: '--amend' passes; a merge-in-progress passes (git forbids pathspec
commits mid-merge); SKIP_SWEEPGUARD=1 for a deliberate whole-index commit.
EOF
  exit 2
}

# A command boundary: start-of-string or after ; | & (handles && and |, too).
B='(^|[;&|])[[:space:]]*'

# git add -A  /  git add --all  /  combined short flags containing A (e.g. -Av)
if printf '%s' "$cmd" | grep -qE "${B}git[[:space:]]+add[[:space:]]+([^;&|]*[[:space:]])?(-A|--all|-[A-Za-z]*A[A-Za-z]*)([[:space:]]|$)"; then
  deny "git add -A / --all"
fi

# git add .   /  git add -- .   /  git add :/   (stage the whole tree)
if printf '%s' "$cmd" | grep -qE "${B}git[[:space:]]+add[[:space:]]+([^;&|]*[[:space:]])?(\.|:/)([[:space:]]|$)"; then
  deny "git add . (whole-tree staging)"
fi

# git add -u / --update  (stages ALL tracked modifications — broad, like -A).
if printf '%s' "$cmd" | grep -qE "${B}git[[:space:]]+add[[:space:]]+([^;&|]*[[:space:]])?(-u|--update|-[A-Za-z]*u[A-Za-z]*)([[:space:]]|$)"; then
  deny "git add -u / --update (stages all tracked edits)"
fi

# git add of an already-TRACKED file — edits don't need staging; commit them
# directly with `git commit -- <path>` (pathspec form uses the working tree). Only
# NEW/untracked files actually need `git add`, so those pass. Directories and globs
# are DELIBERATELY allowed (they may include new files — can't classify without
# crying wolf; kami-kakushi accepted this tradeoff 2026-07-08). We block only a concrete
# path token that git already tracks.
add_seg="$(printf '%s' "$cmd" | grep -oE "${B}git[[:space:]]+add[^;&|]*" | head -1 || true)"
if [ -n "$add_seg" ]; then
  rest="${add_seg#*add}"          # drop the leading 'git add'
  rest="${rest//\"/}"; rest="${rest//\'/}"   # strip quotes (naive; rare spaced paths)
  read -ra _toks <<< "$rest"
  for tok in "${_toks[@]}"; do
    case "$tok" in -*) continue ;; esac        # a flag, not a path
    [ -d "$tok" ] && continue                  # a directory (may hold new files)
    case "$tok" in *[\*\?\[]*) continue ;; esac # a glob (may match new files)
    if git ls-files --error-unmatch -- "$tok" >/dev/null 2>&1; then
      deny "git add of tracked file '$tok' — edits don't need staging; commit it directly: git commit -m \"...\" -- $tok"
    fi
  done
fi

# git commit -a / -am / --all  (stages all tracked modifications). Allow -m, --amend.
if printf '%s' "$cmd" | grep -qE "${B}git[[:space:]]+commit[[:space:]]+([^;&|]*[[:space:]])?(--all|-[A-Za-z]*a[A-Za-z]*)([[:space:]]|$)"; then
  deny "git commit -a / -am / --all"
fi

# git commit WITHOUT an explicit ' -- <pathspec>' — commits the SHARED index, sweeping
# whatever a co-agent staged between your 'git add' and your commit (kami-kakushi f84aff9,
# a prettier-fail retry carried 4 of another agent's staged files). Require the
# canonical pathspec form: git commit -m "..." -- path/a path/b   (--only semantics).
#
# Detection hardening:
#  (kami-kakushi 2026-07-08, after 0e10d96 swept 6 co-agent files) the ' -- ' pathspec must live
#    INSIDE the `git commit` segment, NOT anywhere in the compound command — the old
#    whole-$cmd check let `git diff -- path && git commit -m "..."` (bare) through.
#  (2026-07-09) FLATTEN newlines to spaces FIRST. A multi-line `-m "…"` message made the
#    per-line grep capture only the message's FIRST line, missing the trailing
#    ' -- <pathspec>' that follows the whole message → false-BLOCK (hit 3× in one
#    session). Flattening, then stripping quoted strings, then isolating the commit
#    segment, also stops a ';', '&', or '|' inside the message truncating the segment.
# Allowed bare: --amend, merge-in-progress, SKIP_SWEEPGUARD=1.
cmd_flat="$(printf '%s' "$cmd" | tr '\n' ' ')"
if printf '%s' "$cmd_flat" | grep -qE "${B}git[[:space:]]+commit([[:space:]]|$)" \
  && ! printf '%s' "$cmd_flat" | grep -q 'SKIP_SWEEPGUARD=1' \
  && ! printf '%s' "$cmd_flat" | grep -qE "${B}git[[:space:]]+commit[^;&|]*--amend" \
  && ! [ -e .git/MERGE_HEAD ]; then
  # Strip quoted strings FIRST (on the flattened one-line text, so a multi-line message's
  # quotes actually match and its whole body — including any ' -- ', ';', '&', '|' — is
  # removed), THEN isolate the `git commit …` invocation up to the next ; & | boundary.
  # Only a REAL pathspec — not one in the message or a sibling command — survives.
  # Failure mode is a safe false-BLOCK (escape: SKIP_SWEEPGUARD=1).
  # (2026-09-22) ONE left-to-right pass over both quote kinds, whichever opens first wins: the old
  #   two-pass sed stripped '…' before "…", so an apostrophe INSIDE a double-quoted message
  #   (-m "the user's picks …") paired with a later quote and swallowed the ' -- <pathspec>' → false-BLOCK.
  stripped="$(printf '%s' "$cmd_flat" | perl -pe 's/"(?:[^"\\]|\\.)*"|'"'"'[^'"'"']*'"'"'//g')"
  commit_seg="$(printf '%s' "$stripped" | grep -oE "git[[:space:]]+commit[^;&|]*" | head -1 || true)"
  if ! printf '%s' "$commit_seg" | grep -qE '[[:space:]]--([[:space:]]|$)'; then
    deny_commit
  fi
fi

exit 0
