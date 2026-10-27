#!/usr/bin/env bash
# Compatibility entry: one scheduled tick, no settle loop or old push lock.
# G768: 45-second fail-open check, no quiet or red-main hold.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
exec python3 scripts/push-loop.py
