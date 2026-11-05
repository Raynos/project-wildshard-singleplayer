#!/usr/bin/env bash
# One CI job, three complete checks. Drain all and preserve the original failures.
set -uo pipefail
{
  TIMEFORMAT='Typecheck: %3R seconds'
  time pnpm exec tsc -b tsconfig.layers.json --builders 1 --force
} &
typecheck_pid=$!
{
  TIMEFORMAT='Typed lint: %3R seconds'
  time pnpm run lint:typed --threads=4
} &
typed_lint_pid=$!
{
  TIMEFORMAT='Check paths: %3R seconds'
  time node scripts/check-paths.mjs
} &
check_paths_pid=$!
typecheck_status=0
typed_lint_status=0
check_paths_status=0
wait "$typecheck_pid" || typecheck_status=$?
wait "$typed_lint_pid" || typed_lint_status=$?
wait "$check_paths_pid" || check_paths_status=$?
if [ "$typecheck_status" -ne 0 ]; then
  exit "$typecheck_status"
fi
if [ "$typed_lint_status" -ne 0 ]; then
  exit "$typed_lint_status"
fi
exit "$check_paths_status"
