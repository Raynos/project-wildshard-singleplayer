#!/usr/bin/env bash
# One command to reproduce the Nine Dragon shader failure recovery in both browser engines.
set -euo pipefail

cd "$(dirname "$0")/.."
pnpm build

port=4184
log=$(mktemp)
pnpm exec vite preview --host 127.0.0.1 --port "$port" --strictPort >"$log" 2>&1 &
server_pid=$!
cleanup() { kill "$server_pid" 2>/dev/null || true; wait "$server_pid" 2>/dev/null || true; rm -f "$log"; }
trap cleanup EXIT

ready=0
for _ in {1..50}; do
  if curl -fsS "http://127.0.0.1:$port/version.json" >/dev/null 2>&1; then ready=1; break; fi
  if ! kill -0 "$server_pid" 2>/dev/null; then cat "$log"; exit 1; fi
  sleep 0.2
done

if [[ "$ready" -ne 1 ]]; then cat "$log"; exit 1; fi

node scripts/test-facade-instancing.mjs --url="http://127.0.0.1:$port"

for fault in context precision shader texture; do
  node scripts/test-nine-gpu-boot.mjs --url="http://127.0.0.1:$port" --only=all --fault="$fault"
done

if [[ "$(uname -s)" == Darwin ]]; then
  node scripts/test-nine-native-startup.mjs --url="http://127.0.0.1:$port"
fi
