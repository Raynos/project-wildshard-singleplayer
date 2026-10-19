#!/usr/bin/env bash
# G509/G511: exact-commit types, lint, related tests and one first frame per shard.
# scripts/batch-check.sh [--rev SHA] [--base REF] <shard...>
# Defaults: HEAD against origin/main (the push gate's changed-source range).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec python3 "$ROOT/scripts/quiet_logs.py" --label batch-check -- python3 "$ROOT/scripts/batch_check.py" "$@"
