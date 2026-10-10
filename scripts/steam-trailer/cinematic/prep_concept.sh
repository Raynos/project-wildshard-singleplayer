#!/usr/bin/env bash
# TRAILERS CT6 (E466): conform the concept trailer's generated shots for edit.mjs.
#   prep_concept.sh <shotsDir with b01..b14.mp4> <outDir> <build-beat.mp4> <b03 half-grey still> <hero still>
# Each 1280 × 704 shot → scaled to 1964 × 1080 and centre-cropped to 1920 × 1080, 60 fps (ct2-script.md §The frame);
# b14 is played in reverse (generated as a push-in, council R1C); `term` is the real Claude Code session: the terminal
# panel of the alpha trailer's build beat (scripts/steam-trailer/build-beat.mjs) on the abyss, 1.5 s.
set -euo pipefail
IN=$1 OUT=$2 BEAT=$3 HALF=${4:-} HERO=${5:-}
mkdir -p "$OUT"
for f in "$IN"/b*.mp4; do
  id=$(basename "$f" .mp4)
  vf="scale=1964:1080:flags=lanczos,crop=1920:1080,fps=60"
  [ "$id" = b14 ] && vf="reverse,$vf"
  ffmpeg -loglevel error -y -i "$f" -vf "$vf" -an -c:v libx264 -crf 14 -pix_fmt yuv420p "$OUT/$id.mp4"
  echo "[prep] $id"
done
# b03, the build (council R2C-7): the half-grey still and the finished hero still are pixel-aligned, so the colour sweeps
# across as a soft wipe right → left over 6 s while a slow push-in runs (16:9 stills cropped to the 1964 × 1080 aspect)
if [ -n "$HALF" ] && [ -n "$HERO" ]; then
  ffmpeg -loglevel error -y -loop 1 -t 6.05 -i "$HALF" -loop 1 -t 6.05 -i "$HERO" -filter_complex \
    "[0]scale=2200:-2,crop=2200:1210,fps=60[a];[1]scale=2200:-2,crop=2200:1210,fps=60[b];[a][b]xfade=transition=wipeleft:duration=4.2:offset=0.9,zoompan=z='1+0.0006*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1964x1080:fps=60,crop=1920:1080" \
    -t 6.05 -an -c:v libx264 -crf 14 -pix_fmt yuv420p "$OUT/b03.mp4"
  echo "[prep] b03 (wipe)"
fi
# b15, under the end card: a hold on b07's last frame with a very slow push (council R2C-1: the map behind the card is b07's)
if [ -s "$OUT/b07.mp4" ]; then
  ffmpeg -loglevel error -y -sseof -0.1 -i "$OUT/b07.mp4" -frames:v 1 "$OUT/b07-last.png"
  ffmpeg -loglevel error -y -loop 1 -t 5.05 -i "$OUT/b07-last.png" -vf "zoompan=z='1+0.0004*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=60" \
    -t 5.05 -an -c:v libx264 -crf 14 -pix_fmt yuv420p "$OUT/b15.mp4"
  echo "[prep] b15 (hold on b07)"
fi
# the terminal panel sits at (56, 56), 964 × 884 with its frame, in the build beat (build-beat.mjs layout)
ffmpeg -loglevel error -y -ss 1.0 -t 1.6 -i "$BEAT" -f lavfi -i color=c=0x050a12:s=1920x1080:r=60 -filter_complex \
  "[0]crop=964:884:56:56,scale=-2:940:flags=lanczos,fps=60[t];[1][t]overlay=(W-w)/2:(H-h)/2:shortest=1" \
  -an -c:v libx264 -crf 14 -pix_fmt yuv420p "$OUT/term.mp4"
echo "[prep] term"
