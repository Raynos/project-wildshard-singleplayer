#!/usr/bin/env bash
# x64-vitest.sh — run vitest files under x64 Node through Rosetta, so the Mac push gate sees the Linux x64 digest reds
# (SF74 W28, speed audit #9a). Push CI is Linux x64: V8's native transcendentals round differently there than on arm64,
# so a recorded digest can pass on every Mac and fail every CI run (2026-10-09: sim-memory-interval 49 red runs,
# hunt-brain-oracle 23, goat-ram-oracle 5, player-board-tape 2; DEPLOY.md "CI's vitest is Linux x64").
#
#   scripts/x64-vitest.sh --setup          once per machine: nodejs.org's darwin-x64 build of this Node version and the
#                                          x64 rolldown binding matching node_modules, into ~/.local/node-x64
#   scripts/x64-vitest.sh --digests        the digest tests (*-oracle*, *-tape*, sim-memory-interval; test/proof has its
#                                          own cross-process determinism proof); the push gate runs this as a cached step
#   scripts/x64-vitest.sh <test files…>    any files
#
# Without the setup (another machine, Linux CI, which is x64 already) it says so and exits 0: it never blocks a push.
# WS_NODE_X64_DIR overrides the folder.
set -uo pipefail
dir="${WS_NODE_X64_DIR:-$HOME/.local/node-x64}"
root="$(pwd -P)"

rolldown_version() { # the arm64 binding pnpm installed is the version the x64 one must match
  local p; p="$(ls -d "$root"/node_modules/.pnpm/@rolldown+binding-darwin-arm64@* 2>/dev/null | head -1)"
  [ -n "$p" ] && echo "${p##*@}"
}

if [ "${1:-}" = --setup ]; then
  [ "$(uname -s)" = Darwin ] || { echo "x64-vitest: setup is for macOS (Rosetta)"; exit 0; }
  arch -x86_64 /usr/bin/true 2>/dev/null || { echo "x64-vitest: Rosetta is not installed (softwareupdate --install-rosetta)"; exit 1; }
  version="$(node -v)"; rv="$(rolldown_version)"
  [ -n "$rv" ] || { echo "x64-vitest: no @rolldown/binding-darwin-arm64 in node_modules (pnpm install first)"; exit 1; }
  mkdir -p "$dir" && cd "$dir" || exit 1
  if [ ! -x "node-$version-darwin-x64/bin/node" ]; then
    curl -fsSL -o node.tar.xz "https://nodejs.org/dist/$version/node-$version-darwin-x64.tar.xz" && tar -xJf node.tar.xz && rm -f node.tar.xz || exit 1
  fi
  if [ ! -f "rolldown-binding-darwin-x64-$rv/package/rolldown-binding.darwin-x64.node" ]; then
    npm pack "@rolldown/binding-darwin-x64@$rv" --silent >/dev/null || exit 1
    mkdir -p "rolldown-binding-darwin-x64-$rv" && tar -xzf "rolldown-binding-darwin-x64-$rv.tgz" -C "rolldown-binding-darwin-x64-$rv" && rm -f "rolldown-binding-darwin-x64-$rv.tgz" || exit 1
  fi
  echo "x64-vitest: ready in $dir (node $version x64, rolldown binding $rv)"
  exit 0
fi

node_x64="$(ls -d "$dir"/node-*-darwin-x64/bin/node 2>/dev/null | tail -1)"
rv="$(rolldown_version)"
binding="$dir/rolldown-binding-darwin-x64-$rv/package/rolldown-binding.darwin-x64.node"
if [ "$(uname -s)" != Darwin ] || [ -z "$node_x64" ] || [ -z "$rv" ] || [ ! -f "$binding" ]; then
  echo "x64-vitest: no darwin-x64 Node / rolldown $rv binding under $dir: skipped (run scripts/x64-vitest.sh --setup)"
  exit 0
fi

files=("$@")
if [ "${1:-}" = --digests ]; then
  files=()
  while IFS= read -r f; do files+=("$f"); done < <(find test -path test/proof -prune -o \( -name '*-oracle*.test.ts' -o -name '*-tape*.test.ts' -o -name 'sim-memory-interval.test.ts' \) -print | sort)
fi
[ ${#files[@]} -gt 0 ] || { echo "x64-vitest: no test files"; exit 0; }
echo "x64-vitest: ${#files[@]} file(s) under $("$node_x64" -p 'process.arch + " node " + process.version') (Rosetta)"
NAPI_RS_NATIVE_LIBRARY_PATH="$binding" VITE_CONFIG_NATIVE_IGNORE_WARNING=true exec "$node_x64" node_modules/vitest/vitest.mjs run --reporter=dot "${files[@]}"
