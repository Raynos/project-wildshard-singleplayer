#!/usr/bin/env bash
# PreToolUse(Bash) guard — one push at a time, and no tree-wide destructive git in the shared checkout.
# Ported from kami-kakushi's .claude/hooks/guard-bash-safety.sh (its push-mutex and tree-wide blocks).
#
# Contract: reads the PreToolUse JSON on stdin, inspects .tool_input.command.
# - bare `git push`                          → exit 2 (block): push with scripts/push-main.sh
# - tree-wide restore / checkout / stash / reset --hard / clean -f → exit 2 (block), no escape
# - the same commands on named paths         → exit 0 with a {"systemMessage": ...} warn
# Exits 0 silently otherwise.

set -euo pipefail

cmd="$(jq -r '.tool_input.command // empty' 2>/dev/null || true)"
[ -z "$cmd" ] && exit 0

has() { printf '%s' "$cmd" | grep -qE "$1"; }

# A command boundary: start-of-string or after ; | & (handles && and |, too).
B='(^|[;&|])[[:space:]]*'
# Boundary tolerating leading env assignments (`FOO=1 git …`) — an env prefix
# must not smuggle a destructive git op past the anchor.
BE='(^|[;&|])[[:space:]]*([A-Za-z_][A-Za-z_0-9]*=[^[:space:]]*[[:space:]]+)*'

# ── EXEMPT: isolated git worktrees ───────────────────────────────────────────
# A linked worktree is a private tree — mutations there can't hit a co-agent.
# git-dir differs from git-common-dir only in a linked worktree.
gd="$(git rev-parse --git-dir 2>/dev/null || true)"
gcd="$(git rev-parse --git-common-dir 2>/dev/null || true)"
if [ -n "$gd" ] && [ -n "$gcd" ] && [ "$gd" != "$gcd" ]; then
  exit 0
fi

# ── BLOCK: bare `git push` — pushes go through scripts/push-main.sh ─────────
# 2026-09-22 (E19): six agents pushed the same ~12 MB at once over a ~10–100 KB/s
# uplink and every push hung for 15+ minutes. push-main.sh takes .git/push.lock;
# a held lock leaves your commits local (the push in flight carries them — we
# all share one local main). Escape (rare): SKIP_PUSHLOCK=1.
if has "${BE}git[[:space:]]+push([[:space:]]|$)" && ! has 'SKIP_PUSHLOCK=1'; then
  cat >&2 <<'EOF'
BLOCKED by .claude/hooks/guard-bash-safety.sh: bare 'git push'.

Pushes are one at a time over a slow uplink — six parallel pushes of the same
pack hung for 15+ minutes (E19). Use:

    scripts/push-main.sh

It takes .git/push.lock, pushes origin main, and keeps pushing until origin/main
has every local commit. If another push holds the lock it leaves your commits
LOCAL and exits 0 — that push carries them (everyone shares one local main).
Shipped? `git log origin/main..main` is empty. Escape (rare): SKIP_PUSHLOCK=1.
EOF
  exit 2
fi

# ── BLOCK: tree-wide destructive git ops (no env escape) ─────────────────────
# restore/checkout/stash/reset --hard/clean -f in TREE-WIDE form destroy
# co-agents' uncommitted WIP wholesale. Named-path forms stay a warn below;
# tree-wide forms have NO escape var — naming explicit paths IS the escape.
deny_tree_wide() {
  cat >&2 <<EOF
BLOCKED by .claude/hooks/guard-bash-safety.sh: $1 (tree-wide destructive op).

This shared tree carries other agents' uncommitted WIP. A tree-wide
$1 destroys it wholesale. There is NO escape var for this —
name the explicit paths you authored instead, e.g.:

    git restore --staged --worktree -- path/you/authored.ts
    git checkout -- path/you/authored.ts
    git stash push -- path/you/authored.ts
EOF
  exit 2
}
# restore/checkout with a whole-tree target token (. or :/)
if has "${BE}git[[:space:]]+(restore|checkout)([[:space:]]+[^;&|[:space:]]+)*[[:space:]]+(\.|:/)([[:space:]]|$)"; then
  deny_tree_wide "git restore/checkout ."
fi
# bare stash / stash push without an explicit ' -- <pathspec>'
if has "${BE}git[[:space:]]+stash([[:space:]]+push)?([[:space:]]+-[A-Za-z-]+)*[[:space:]]*([;&|]|$)"; then
  deny_tree_wide "git stash (whole-tree)"
fi
# reset --hard is whole-tree by nature
if has "${BE}git[[:space:]]+reset[[:space:]]+([^;&|]*[[:space:]])?--hard([[:space:]]|$)"; then
  deny_tree_wide "git reset --hard"
fi
# clean -f with no explicit path token
clean_seg="$(printf '%s' "$cmd" | grep -oE "${B}git[[:space:]]+clean[^;&|]*" | head -1 || true)"
if [ -n "$clean_seg" ] && printf '%s' "$clean_seg" | grep -qE '(-[A-Za-z]*f[A-Za-z]*|--force)'; then
  rest="${clean_seg#*clean}"
  has_path=0
  for tok in $rest; do
    case "$tok" in -*) continue ;; *) has_path=1 ;; esac
  done
  [ "$has_path" = 0 ] && deny_tree_wide "git clean -f (no paths)"
fi

# ── WARN: tree-mutating git commands on named paths ──────────────────────────
# stash / restore / clean -f are always flagged; checkout and switch are flagged
# unless they only create a branch (-b/-B, -c/-C).
tree_mut=0
has "${B}git[[:space:]]+(stash|restore)([[:space:]]|$)" && tree_mut=1
has "${B}git[[:space:]]+clean[[:space:]]+([^;&|]*[[:space:]])?(-[A-Za-z]*f[A-Za-z]*|--force)([[:space:]]|$)" && tree_mut=1
if has "${B}git[[:space:]]+(checkout|switch)([[:space:]]|$)" \
  && ! has "${B}git[[:space:]]+(checkout[[:space:]]+-[bB]|switch[[:space:]]+-[cC])([[:space:]]|$)"; then
  tree_mut=1
fi
if [ "$tree_mut" = 1 ]; then
  jq -n --arg m '🌲 Shared tree: this command can discard another agent'\''s WIP. Only proceed on paths you authored this session; to inspect, use read-only `git show` / `git diff` instead.' '{systemMessage: $m}'
fi

exit 0
