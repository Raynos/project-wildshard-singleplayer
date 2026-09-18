#!/bin/bash
# Editor's cuts from the same frame folders. usage: cut.sh <frames dir> <edl file> <out.mp4> [bpm]
# EDL lines:  card <id> <secs>   |   vision <file> <start> <secs>   |   shot <name> <startFrame> <nFrames>
set -e
cd "$(dirname "$0")"
F=$1; EDL=$2; OUT=$3; BPM=${4:-96}
SRC=/Users/raynos/projects/project-wildshard-singleplayer/sources
T=$(mktemp -d); FPS=30; i=0
while read -r kind a b c; do
  [ -z "$kind" ] && continue
  n=$(printf %03d $i); i=$((i+1))
  case "$kind" in
    card)   ffmpeg -nostdin -v error -y -loop 1 -framerate $FPS -t "$b" -i "cards/$a.png" -vf "fade=t=in:st=0:d=0.25,fade=t=out:st=$(python3 -c "print(max(0,$b-0.3))"):d=0.3,format=yuv420p" -r $FPS -c:v libx264 -crf 18 -pix_fmt yuv420p "$T/$n.mp4" ;;
    vision) ffmpeg -nostdin -v error -y -ss "$b" -t "$c" -i "$SRC/$a" -vf "scale=1600:900:force_original_aspect_ratio=increase,crop=1600:900,minterpolate=fps=$FPS:mi_mode=blend,fade=t=in:st=0:d=0.3,fade=t=out:st=$(python3 -c "print(max(0,$c-0.3))"):d=0.3,format=yuv420p" -r $FPS -c:v libx264 -crf 18 -pix_fmt yuv420p "$T/$n.mp4" ;;
    shot)   ffmpeg -nostdin -v error -y -framerate $FPS -start_number "$b" -i "$F/$a/%05d.jpg" -frames:v "$c" -vf "scale=1600:900,format=yuv420p" -r $FPS -c:v libx264 -crf 18 -pix_fmt yuv420p "$T/$n.mp4" ;;
  esac
  printf "file '%s'\n" "$T/$n.mp4" >> "$T/list.txt"
done < "$EDL"
ffmpeg -v error -y -f concat -safe 0 -i "$T/list.txt" -c copy "$T/video.mp4"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$T/video.mp4")
# score: drone + surf + a pulse at BPM, quick in, 1.5 s out
ffmpeg -v error -y -f lavfi -i "sine=frequency=55:duration=$DUR" -f lavfi -i "sine=frequency=82.41:duration=$DUR" -f lavfi -i "anoisesrc=color=pink:duration=$DUR:seed=7" -f lavfi -i "sine=frequency=110:duration=$DUR" \
  -filter_complex "[0]volume=0.22[a];[1]volume=0.14,tremolo=f=0.11:d=0.5[b];[2]bandpass=f=420:w=380,volume='0.05+0.05*sin(2*PI*t/5.1)':eval=frame[c];[3]volume='0.14*max(0,sin(2*PI*t*$BPM/60))*max(0,sin(2*PI*t*$BPM/60))':eval=frame,lowpass=f=300[d];[a][b][c][d]amix=inputs=4:normalize=0,lowpass=f=2400,afade=t=in:st=0:d=0.8,afade=t=out:st=$(python3 -c "print(max(0,$DUR-1.5))"):d=1.5,volume=0.9" \
  -c:a aac -b:a 160k "$T/score.m4a"
ffmpeg -v error -y -i "$T/video.mp4" -i "$T/score.m4a" -c:v copy -c:a aac -b:a 160k -shortest -movflags +faststart "$OUT"
echo "wrote $OUT (${DUR}s)"; rm -rf "$T"
