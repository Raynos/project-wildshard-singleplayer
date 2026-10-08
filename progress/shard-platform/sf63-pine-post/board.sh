#!/usr/bin/env bash
# SF63 follow-up boards: SHARD SELECT (standalone-<pose>.jpg from ../playtest-2-drivein/standalone.mjs at the drive's poses),
# grid before (HEAD) and grid after (this change), side by side at the same shard-local pose. bash board.sh <pose> …
set -euo pipefail
cd "$(dirname "$0")"
for pose in "$@"; do
  magick \( "standalone-$pose.jpg" -resize x900 -gravity north -background '#111' -splice 0x40 -fill white -pointsize 28 -annotate +0+4 'SHARD SELECT' \) \
         \( "$pose-before.jpg" -resize x900 -gravity north -background '#111' -splice 0x40 -fill white -pointsize 28 -annotate +0+4 'grid before' \) \
         \( "$pose-after.jpg" -resize x900 -gravity north -background '#111' -splice 0x40 -fill white -pointsize 28 -annotate +0+4 'grid after' \) \
         +append -quality 78 "board-$pose.jpg"
done
