#!/bin/bash
# gen-all.sh <id>... : run gen.sh for each id, at most 3 at once
D="$(cd "$(dirname "$0")" && pwd)"
for id in "$@"; do
  while [ "$(jobs -rp | wc -l)" -ge 3 ]; do sleep 3; done
  bash "$D/gen.sh" "$id" &
  sleep 1
done
wait
