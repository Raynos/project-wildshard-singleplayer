#!/usr/bin/env bash
# vercel-tree-gate.sh — build a commit exactly as the Vercel deploy will see it, so a bad push fails HERE, not upstream.
#
# Why (E41, 2026-09-23): CI's gates build the full checkout, then `vercel deploy` uploads the tree MINUS .vercelignore and
# Vercel builds that. An unanchored `art` line dropped src/explore/art/ on Vercel only: f94c5da + e507b24 went red after
# every CI gate was green. This gate:
#   1. fails if .vercelignore excludes any tracked file under src/ public/ api/ scripts/ (or a top-level file);
#   2. checks out ONLY the files Vercel would upload (gitignore rules of the commit's own .vercelignore) into a temp dir;
#   3. runs the CI gates there: check-css, typecheck (app + api), oxlint, vitest, vite build.
# A commit that passed is stamped in .git/vercel-gate/ and never re-built.
#
#   scripts/vercel-tree-gate.sh [<commit>]     (default HEAD; .githooks/pre-push runs it on the pushed tip)
#   escape (rare, logged in the push output only): SKIP_VERCEL_GATE=1 scripts/push-main.sh
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1
ROOT="$PWD"

sha="$(git rev-parse --verify "${1:-HEAD}^{commit}")" || exit 1
short="$(git rev-parse --short "$sha")"
stamp_dir="$(git rev-parse --git-common-dir)/vercel-gate"
if [ -f "$stamp_dir/$sha" ]; then echo "vercel-gate: $short already passed"; exit 0; fi

work="$(mktemp -d -t vercel-gate)" || exit 1
trap 'rm -rf "$work"' EXIT
fail() { echo "vercel-gate: FAILED at $short — $1" >&2; echo "            (Vercel would have built this tree and gone red; fix it and commit, then push again)" >&2; exit 1; }

# ── 1. what Vercel uploads: the commit's files minus its .vercelignore (gitignore syntax, checked in an empty repo) ──
git init -q "$work/ign"
git show "$sha:.vercelignore" > "$work/vercelignore" 2>/dev/null || : > "$work/vercelignore"
git ls-tree -r --name-only "$sha" > "$work/all"
git -C "$work/ign" -c core.excludesFile="$work/vercelignore" check-ignore --no-index --stdin < "$work/all" > "$work/ignored" || true
bad="$(grep -E '^(src|public|api|scripts)/|^[^/]+$' "$work/ignored" | grep -vxF '.vercelignore' | head -20)"
if [ -n "$bad" ]; then
  echo "$bad" | sed 's/^/    ignored: /' >&2
  fail ".vercelignore excludes build inputs (anchor the pattern with a leading /)"
fi
grep -vxFf "$work/ignored" "$work/all" > "$work/keep"

# ── 2. check out only those files ──
mkdir -p "$work/tree"
GIT_INDEX_FILE="$work/index" git read-tree "$sha" || fail "read-tree"
tr '\n' '\0' < "$work/keep" | GIT_INDEX_FILE="$work/index" git checkout-index -z --stdin --prefix="$work/tree/" || fail "checkout-index"
ln -s "$ROOT/node_modules" "$work/tree/node_modules"

# ── 3. the CI gates, in the Vercel tree ──
cd "$work/tree" || exit 1
echo "vercel-gate: $short — $(wc -l < "$work/keep" | tr -d ' ') files as Vercel sees them; check-css · typecheck · oxlint · vitest · vite build"
run() { local name="$1"; shift; local t0=$SECONDS; if ! "$@" > "$work/$name.log" 2>&1; then tail -40 "$work/$name.log" >&2; fail "$name"; fi; echo "  ✓ $name ($((SECONDS - t0)) s)"; }
run check-css node scripts/check-css.mjs
run typecheck pnpm exec tsc --noEmit
run typecheck-api pnpm exec tsc --noEmit -p api
run oxlint pnpm exec oxlint
run vitest pnpm exec vitest run
run vite-build pnpm exec vite build --outDir "$work/dist" --emptyOutDir

mkdir -p "$stamp_dir" && touch "$stamp_dir/$sha"
echo "vercel-gate: $short passed"
