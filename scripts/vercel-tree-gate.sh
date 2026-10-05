#!/usr/bin/env bash
# vercel-tree-gate.sh — build a commit exactly as the Vercel deploy will see it, so a bad push fails HERE, not upstream.
#
# Why (E41, 2026-09-23): CI's gates build the full checkout, then `vercel deploy` uploads the tree MINUS .vercelignore and
# Vercel builds that. An unanchored `art` line dropped src/explore/art/ on Vercel only: f94c5da + e507b24 went red after
# every CI gate was green. This gate:
#   1. fails if .vercelignore excludes any tracked file under src/ public/ api/ scripts/ (or a top-level file);
#   2. checks out ONLY the files Vercel would upload (gitignore rules of the commit's own .vercelignore) into a temp dir;
#   3. runs the CI gates there: check-css, typecheck (app + api), oxlint, node-only bake-check, vitest, vite build.
# A commit that passed is stamped in .git/vercel-gate-platform-ratchets-v5-devserver/ and never re-built.
#
#   scripts/vercel-tree-gate.sh [<commit>]     (default HEAD; .githooks/pre-push runs it on the pushed tip)
#   escape (rare, logged in the push output only): SKIP_VERCEL_GATE=1 scripts/push-main.sh
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1
ROOT="$PWD"

sha="$(git rev-parse --verify "${1:-HEAD}^{commit}")" || exit 1
short="$(git rev-parse --short "$sha")"
stamp_dir="$(git rev-parse --path-format=absolute --git-common-dir)/vercel-gate-platform-ratchets-v5-devserver"
# Historical pins keep their original gate; the source-only workflow begins with its runner wiring.
generated_workflow=0
if git show "$sha:scripts/push-main.sh" | grep -q 'node scripts/regenerate-committed.mjs'; then
  generated_workflow=1
  stamp_dir="$(git rev-parse --path-format=absolute --git-common-dir)/vercel-gate-platform-ratchets-v6-generated"
fi
if [ -f "$stamp_dir/$sha" ]; then echo "vercel-gate: $short already passed"; exit 0; fi

work="$(cd "$(mktemp -d -t vercel-gate)" && pwd -P)" || exit 1 # canonical: /var is a symlink on macOS (E432)
trap 'rm -rf "$work"' EXIT
fail() { echo "vercel-gate: FAILED at $short — $1" >&2; echo "            (Vercel would have built this tree and gone red; fix it and commit, then push again)" >&2; exit 1; }

# Verify the full committed docs and policy inputs before Vercel's filter drops docs/.
if [ "$generated_workflow" = 1 ]; then
  node "$ROOT/scripts/regenerate-committed.mjs" --check "$sha" || fail "generated outputs and increase receipts"
fi

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
node "$ROOT/scripts/link-node-modules.mjs" "$ROOT" "$work/tree" || fail "link node_modules" # E432: @wildshard/* → this tree

# Historical allowances come from the predecessor, even in this export without .git.
mkdir -p "$work/predecessor"
predecessor_lists=(lint/row-functions.json lint/edge-exemptions.json lint/shard-platform.json lint/sim-closure.json lint/shard-coupling.json)
if git cat-file -e "$sha^:lint/sim-schema-leaves.json" 2>/dev/null; then predecessor_lists+=(lint/sim-schema-leaves.json); fi
if git cat-file -e "$sha^:lint/weapon-subclasses.json" 2>/dev/null; then predecessor_lists+=(lint/weapon-subclasses.json); fi
git archive "$sha^" -- "${predecessor_lists[@]}" | tar -xf - -C "$work/predecessor" || fail "predecessor lists"

# ── 3. the CI gates, in the Vercel tree ──
cd "$work/tree" || exit 1
echo "vercel-gate: $short — $(wc -l < "$work/keep" | tr -d ' ') files as Vercel sees them; check-css · typecheck · oxlint · bake-check · vitest · vite build"
run() { local name="$1"; shift; local t0=$SECONDS; if ! "$@" > "$work/$name.log" 2>&1; then tail -40 "$work/$name.log" >&2; fail "$name"; fi; echo "  ✓ $name ($((SECONDS - t0)) s)"; }
run platform-ratchets node scripts/check-platform-ratchets.mjs "$work/predecessor" "$work/tree"
run check-css node scripts/check-css.mjs
run gen pnpm gen --check-budgets
run gen-check node scripts/gen-shards.mjs --check
run shard-coupling node scripts/shard-coupling.mjs --check
run typecheck pnpm exec tsc --noEmit
run typecheck-layers pnpm exec tsc -b tsconfig.layers.json   # E362 AG4: no layer reaches up, in any syntax
run typecheck-api pnpm exec tsc --noEmit -p api
run typecheck-scripts pnpm exec tsc --noEmit -p scripts   # CI runs it in pnpm typecheck; fc043dfe went red there with this gate green
run oxlint pnpm exec oxlint
run ratchet node lint/ratchet.mjs
# CI runs this in `pnpm test`; a stale scripts/README.md failed the 96239386 deploy run with this gate green
[ -f scripts/normalize/liveness.mjs ] && [ -f scripts/README.md ] && run liveness node scripts/normalize/liveness.mjs --readme --check
# CI checks committed terrain, sky metadata and navmeshes; stale bakes must block the push too.
run bake-check node scripts/bake-check.mjs --node-only
run vitest pnpm exec vitest run
run script-conformance bash scripts/browser-lane.sh --max 5 node scripts/script-conformance.mjs
run shardfiles node scripts/build-shardfiles.mjs
run vite-build pnpm exec vite build --outDir "$work/dist" --emptyOutDir
run assert-devserver node scripts/check-devserver.mjs "$work/dist"
run check-chunks node scripts/check-chunks.mjs "$work/dist"
run shard-platform node scripts/shard-platform.mjs --check && sed 's/^/    /' "$work/shard-platform.log" # SHARD-PLATFORM SP5: each shard's custom share

mkdir -p "$stamp_dir" && touch "$stamp_dir/$sha"
echo "vercel-gate: $short passed"
