#!/usr/bin/env bash
# G363: local changed-file checks only; complete builds/bakes/tests run in CI.
# The Python owner enforces one deadline and kills only its child groups.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1
exec python3 scripts/local-gate.py "${1:-HEAD}"
