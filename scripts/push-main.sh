#!/usr/bin/env bash
# Compatibility entry: one scheduled tick, no settle loop or old push lock.
# PUSH_SINGLE_BATCH is inherent: every invocation checks and uploads once.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
exec python3 scripts/push-loop.py
