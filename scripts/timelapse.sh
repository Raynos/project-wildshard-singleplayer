#!/bin/bash
# Assemble progress/timelapse.mp4 from the numbered screenshots in progress/ (sorted by name),
# 0.6 s per frame, scaled to 1600x900 with a caption of the filename.
set -e
cd "$(dirname "$0")/.."
LIST=$(mktemp)
for f in $(ls progress/*.png | sort); do
  echo "file '$PWD/$f'" >> "$LIST"; echo "duration 0.6" >> "$LIST"
done
last=$(ls progress/*.png | sort | tail -1); echo "file '$PWD/$last'" >> "$LIST"
ffmpeg -v error -y -f concat -safe 0 -i "$LIST" \
  -vf "scale=1600:900:force_original_aspect_ratio=decrease,pad=1600:900:(ow-iw)/2:(oh-ih)/2:color=#050810,format=yuv420p" \
  -r 30 -c:v libx264 -pix_fmt yuv420p -crf 20 progress/timelapse.mp4
rm "$LIST"
echo "wrote progress/timelapse.mp4 ($(ls progress/*.png | wc -l | tr -d ' ') frames)"
