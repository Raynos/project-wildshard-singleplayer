#!/usr/bin/env bash
# Compatibility entry: one scheduled tick, no settle loop or old push lock.
# PUSH_SINGLE_BATCH is inherent: every invocation checks and uploads once.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
if command -v launchctl >/dev/null && launchctl print "gui/$(id -u)/com.wildshard.push" >/dev/null 2>&1; then
  exec launchctl kickstart "gui/$(id -u)/com.wildshard.push"
fi
exec python3 scripts/push-loop.py
