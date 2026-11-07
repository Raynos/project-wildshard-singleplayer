#!/usr/bin/env bash
# Shared machine admission remains owned by the installed engine tool closure.
set -euo pipefail
engine_tools="${WS_ENGINE_SOURCE:-$HOME/projects/games/wildshard/engine}"
[ ! -f engine-source/scripts/browser-lane.sh ] || engine_tools=engine-source
[ -x "$engine_tools/scripts/browser-lane.sh" ] || { echo 'Install the pinned engine tooling before opening a game browser' >&2; exit 1; }
exec bash "$engine_tools/scripts/browser-lane.sh" "$@"
