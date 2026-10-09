#!/usr/bin/env bash
# vercel-tree-gate.sh — build a commit exactly as the Vercel deploy will see it, so a bad push fails HERE, not upstream.
#
# Why (E41, 2026-09-23): CI's gates build the full checkout, then `vercel deploy` uploads the tree MINUS .vercelignore and
# Vercel builds that. An unanchored `art` line dropped src/explore/art/ on Vercel only: f94c5da + e507b24 went red after
# every CI gate was green. This gate:
#   1. fails if .vercelignore excludes any tracked file under src/ public/ api/ scripts/ (or a top-level file);
#   2. checks out ONLY the files Vercel would upload (gitignore rules of the commit's own .vercelignore) into a temp dir;
#   3. runs the CI gates there: check-css, typecheck (app + api), oxlint, node-only bake-check, vitest, vite build.
# A commit that passed is stamped in .git/vercel-gate-platform-ratchets-v7-ci-checks/ and never re-built.
# Process audit 2026-10-09 (scripts/gate-cache.mjs): bake-check and the node audits are skipped when every input they
# read last time (traced by scripts/gate-trace.mjs) is byte-identical, and vitest runs only `vitest related` to the
# files changed since the last gate whose vitest passed. Every FULL_EVERY-th gate, any gate FULL_HOURS after the last
# full one, a change to package / test setup / config files, and GATE_FULL=1 run everything. CI always runs everything.
# E454 (Jake: "max 2 minutes the pre push"): the independent steps run in parallel and each prints its own wall time;
# the generated-outputs check runs beside the export instead of before it.
#
#   scripts/vercel-tree-gate.sh [<commit>]     (default HEAD; .githooks/pre-push runs it on the pushed tip)
#   escape (rare, logged in the push output only): SKIP_VERCEL_GATE=1 scripts/push-main.sh
set -uo pipefail
# Run from a private snapshot: bash reads a script as it goes, so a gate edit copied into the shared tree mid-run broke
# a live push (2026-10-09, "syntax error near unexpected token `done'"). The snapshot is removed when the gate exits.
if [ -z "${GATE_SNAPSHOT:-}" ]; then
  snap="$(mktemp -t vercel-tree-gate)" && cp "${BASH_SOURCE[0]}" "$snap" && GATE_SNAPSHOT="$snap" exec bash "$snap" "$@"
  exit 1
fi
cd "$(git rev-parse --show-toplevel)" || exit 1
ROOT="$PWD"

sha="$(git rev-parse --verify "${1:-HEAD}^{commit}")" || exit 1
short="$(git rev-parse --short "$sha")"
stamp_dir="$(git rev-parse --path-format=absolute --git-common-dir)/vercel-gate-platform-ratchets-v5-devserver"
# Historical pins keep their original gate; the source-only workflow begins with its runner wiring.
generated_workflow=0
if git show "$sha:scripts/push-main.sh" | grep -q 'node scripts/regenerate-committed.mjs'; then
  generated_workflow=1
  stamp_dir="$(git rev-parse --path-format=absolute --git-common-dir)/vercel-gate-platform-ratchets-v7-ci-checks"
fi
if [ -f "$stamp_dir/$sha" ]; then echo "vercel-gate: $short already passed"; rm -f "$GATE_SNAPSHOT"; exit 0; fi

# Reserve both resources before exporting; queue time is separate from the E454 gate wall time.
if [ "${WS_HEAVY_GATE:-}" != 1 ] || ! node --input-type=module -e \
  "import {assertHeavyLease} from './scripts/heavy-lane-lease.mjs'; assertHeavyLease('full-test'); assertHeavyLease('build');" >/dev/null 2>&1; then
  exec python3 "$ROOT/scripts/heavy-lane.py" gate -- bash "${BASH_SOURCE[0]}" "$@"
fi

work="$(cd "$(mktemp -d -t vercel-gate)" && pwd -P)" || exit 1 # canonical: /var is a symlink on macOS (E432)
trap 'kill $(jobs -p) 2>/dev/null; rm -rf "$work" "$GATE_SNAPSHOT"' EXIT
fail() { echo "vercel-gate: FAILED at $short — $1" >&2; echo "            (Vercel would have built this tree and gone red; fix it and commit, then push again)" >&2; exit 1; }
gate_t0=$SECONDS
steps=()
# run <name> <cmd…>: one step, its log, exit code and wall seconds in $work. Jobs below call it in the background.
run() { local name="$1"; shift; local t0=$SECONDS; "$@" > "$work/$name.log" 2>&1; local rc=$?; echo "$((SECONDS - t0))" > "$work/$name.sec"; echo "$rc" > "$work/$name.rc"; return "$rc"; }

# Verify the full committed docs and policy inputs before Vercel's filter drops docs/ (its own committed export, so it
# runs beside this one).
# A regeneration commit that scripts/regenerate-committed.mjs built and verified in this push carries a stamp; its check
# would repeat the same clean export and the same comparison (57-107 s), so it is skipped. Any other tip is checked.
verified="$(git rev-parse --path-format=absolute --git-common-dir)/generated-verified/$sha"
if [ "$generated_workflow" = 1 ] && [ -f "$verified" ]; then
  steps+=(generated); echo 0 > "$work/generated.sec"; echo 0 > "$work/generated.rc"
  echo "verified by the regeneration commit at push" > "$work/generated.cached"
elif [ "$generated_workflow" = 1 ]; then
  steps+=(generated)
  run generated node "$ROOT/scripts/regenerate-committed.mjs" --check "$sha" &
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
# awk, not `grep -vxFf`: BSD grep takes ~40 s on 10 000 fixed-string patterns (E454)
awk 'NR == FNR { ignored[$0] = 1; next } !($0 in ignored)' "$work/ignored" "$work/all" > "$work/keep"

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
if git cat-file -e "$sha^:lint/legacy-shards.json" 2>/dev/null; then predecessor_lists+=(lint/legacy-shards.json); fi
git archive "$sha^" -- "${predecessor_lists[@]}" | tar -xf - -C "$work/predecessor" || fail "predecessor lists"

# ── 3. the CI gates, in the Vercel tree: gen first, then every independent step at once (E454) ──
cd "$work/tree" || exit 1
full=1; cache="$ROOT/scripts/gate-cache.mjs"
if [ -f "$cache" ] && ! node "$cache" full?; then full=0; fi
echo "vercel-gate: $short — $(wc -l < "$work/keep" | tr -d ' ') files as Vercel sees them; check-css · typecheck · oxlint · bake-check · vitest · vite build (parallel, $([ "$full" = 1 ] && echo full || echo cached))"
job() { steps+=("$1"); run "$@" & }
# cached <name> <cmd…>: a node step skipped when its traced inputs are unchanged since it last passed (gate-cache.mjs)
cached() {
  local name="$1"; shift
  if [ ! -f "$cache" ]; then job "$name" "$@"; return; fi
  steps+=("$name")
  ( export GATE_CACHE_COMMAND="$*"
    if [ "$full" = 0 ] && node "$cache" check "$name" "$work/tree" > "$work/$name.cached" 2>/dev/null; then
      echo 0 > "$work/$name.sec"; echo 0 > "$work/$name.rc"; exit 0
    fi
    : > "$work/$name.cached"; mkdir -p "$work/trace-$name"
    GATE_TRACE_ROOT="$work/tree" GATE_TRACE_DIR="$work/trace-$name" \
      NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--import=file://$ROOT/scripts/gate-trace.mjs" run "$name" "$@" || exit 1
    node "$cache" record "$name" "$work/tree" "$work/trace-$name" "$sha" >> "$work/$name.log" 2>&1 || true ) &
}
# vitest: the whole suite on a full gate, else only the tests related to the files changed since vitest last passed
vitest_mode=full; vitest_files=()
if [ "$full" = 0 ]; then
  plan="$(node "$cache" vitest-plan "$work/tree" "$sha" 2>/dev/null || echo full)"
  case "$plan" in full) ;; none) vitest_mode=none;; *) vitest_mode=related; while IFS= read -r f; do vitest_files+=("$f"); done <<< "$plan";; esac
fi
vitest_step() {
  case "$vitest_mode" in
    full) pnpm exec vitest run || return 1;;
    related) echo "vitest related: ${#vitest_files[@]} changed file(s)"; pnpm exec vitest related --run --passWithNoTests "${vitest_files[@]}" || return 1;;
    none) echo "vitest: no changed file is in the Vercel tree";;
  esac
  [ ! -f "$cache" ] || node "$cache" vitest-pass "$sha" "$vitest_mode"
}
# chain <name> <cmd…> [-- <name> <cmd…>]…: steps that must run in order (one background job)
chain() {
  local -a cmd=(); local -a all=("$@" --)
  for word in "${all[@]}"; do
    if [ "$word" = -- ]; then steps+=("${cmd[0]}"); cmd=(); else cmd+=("$word"); fi
  done
  ( local -a c=(); for word in "${all[@]}"; do
      if [ "$word" = -- ]; then run "${c[@]}" || exit 1; c=(); else c+=("$word"); fi
    done ) &
}
# These two write the tree's generated files and policy inputs that the rest read, so they finish first.
steps+=(platform-ratchets gen)
run platform-ratchets node scripts/check-platform-ratchets.mjs "$work/predecessor" "$work/tree" &&
  run gen pnpm gen --check-budgets
if [ "$(cat "$work/gen.rc" 2>/dev/null || echo 1)" = 0 ]; then
  job check-css node scripts/check-css.mjs
  job gen-check node scripts/gen-shards.mjs --check
  cached shard-coupling node scripts/shard-coupling.mjs --check
  job typecheck pnpm exec tsc --noEmit
  job typecheck-layers pnpm exec tsc -b tsconfig.layers.json   # E362 AG4: no layer reaches up, in any syntax
  job typecheck-api pnpm exec tsc --noEmit -p api
  job typecheck-scripts pnpm exec tsc --noEmit -p scripts   # CI runs it in pnpm typecheck; fc043dfe went red there with this gate green
  job oxlint pnpm exec oxlint
  # The stamped regeneration commit was built from `ratchet.mjs --measure` on this same src (rises refused without the
  # receipt, Debug-row cap and zero-rule checks fatal there too), so the check-mode rerun is skipped for it only.
  if [ -f "$verified" ]; then
    steps+=(ratchet); echo 0 > "$work/ratchet.sec"; echo 0 > "$work/ratchet.rc"
    echo "measured by the regeneration commit at push" > "$work/ratchet.cached"
  else job ratchet node lint/ratchet.mjs; fi
  # CI runs this in `pnpm test`; a stale scripts/README.md failed the 96239386 deploy run with this gate green
  [ -f scripts/normalize/liveness.mjs ] && [ -f scripts/README.md ] && job liveness node scripts/normalize/liveness.mjs --readme --check
  # CI's `pnpm test:checks` runs these too; e9128c290 went red on audit-assets and the WebGPU inventory with
  # this gate green (2026-10-07), so the push checks them before CI does. (check-paths needs the full checkout: the
  # Vercel tree drops test/parity, so it stays a CI check.)
  cached audit-assets node scripts/audit-assets.mjs
  cached check-model-sources node scripts/check-model-sources.mjs
  cached webgpu-inventory node scripts/webgpu-inventory.mjs --check
  # CI checks committed terrain, sky metadata and navmeshes; stale bakes must block the push too.
  cached bake-check node scripts/bake-check.mjs --node-only
  job vitest vitest_step
  job script-conformance env BROWSER_LANE_PRIORITY=1 bash scripts/browser-lane.sh --max 5 node scripts/script-conformance.mjs
  # vite build writes nothing in the tree after gen (checked 2026-10-07), so it runs beside the readers
  chain shardfiles node scripts/build-shardfiles.mjs \
    -- vite-build pnpm exec vite build --outDir "$work/dist" --emptyOutDir \
    -- assert-devserver node scripts/check-devserver.mjs "$work/dist" \
    -- check-chunks node scripts/check-chunks.mjs "$work/dist" \
    -- shard-platform node scripts/shard-platform.mjs --check \
    -- webkit-smoke env BROWSER_LANE_PRIORITY=1 bash scripts/browser-lane.sh --max 3 node scripts/webkit-render-smoke.mjs --dist="$work/dist"
  # shard-platform: SHARD-PLATFORM SP5, each shard's custom share. webkit-smoke (E460, ~5 s): the built template in
  # Playwright WebKit as the phone; fails when a held item or the world view renders near black.
fi
wait
failed=()
for name in "${steps[@]}"; do
  rc="$(cat "$work/$name.rc" 2>/dev/null || echo skipped)"
  if [ "$rc" = 0 ] && [ -s "$work/$name.cached" ]; then echo "  ✓ $name (cached: inputs of $(cat "$work/$name.cached"))"
  elif [ "$rc" = 0 ] && [ "$name" = vitest ] && [ "$vitest_mode" != full ]; then echo "  ✓ vitest ($(cat "$work/$name.sec") s, $vitest_mode ${#vitest_files[@]} file(s))"
  elif [ "$rc" = 0 ]; then echo "  ✓ $name ($(cat "$work/$name.sec") s)"
  elif [ "$rc" = skipped ]; then echo "  - $name (not reached)"
  else echo "  ✗ $name ($(cat "$work/$name.sec") s)"; failed+=("$name"); fi
done
# Every failing test first (vitest prints one ' FAIL ' line per failed test; the 40-line tail alone hid most of them).
for name in ${failed[@]+"${failed[@]}"}; do
  echo "── $name ──" >&2
  grep -E '^ *FAIL ' "$work/$name.log" | sort -u >&2
  tail -40 "$work/$name.log" >&2
done
[ ${#failed[@]} -eq 0 ] || fail "${failed[*]}"
[ -f "$work/shard-platform.log" ] && sed 's/^/    /' "$work/shard-platform.log"
echo "vercel-gate: $short gates took $((SECONDS - gate_t0)) s wall ($([ "$full" = 1 ] && echo full || echo cached))"
if [ -f "$cache" ]; then if [ "$full" = 1 ]; then node "$cache" full-pass "$sha"; else node "$cache" partial-pass "$sha"; fi; fi

mkdir -p "$stamp_dir" && touch "$stamp_dir/$sha"
echo "vercel-gate: $short passed"
