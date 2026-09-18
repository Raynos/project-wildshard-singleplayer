#!/bin/bash
# Assemble the trailer: cards (hold + fade) + citadel vision clip + gameplay shots (30 fps jpg sequences) → mp4.
# usage: assemble.sh <frames dir> <out.mp4>
set -e
cd "$(dirname "$0")"
F=${1:-frames}; OUT=${2:-wildshard-trailer.mp4}
SRC=/Users/raynos/projects/project-wildshard-singleplayer/sources
T=$(mktemp -d)
FPS=30
i=0
seg() { printf "file '%s'\n" "$1" >> "$T/list.txt"; }

# a still card held for N seconds with fade in/out
card() { # id secs
  local n=$(printf %03d $i); i=$((i+1))
  ffmpeg -v error -y -loop 1 -framerate $FPS -t "$2" -i "cards/$1.png" -vf "fade=t=in:st=0:d=0.6,fade=t=out:st=$(python3 -c "print($2-0.7)"):d=0.7,format=yuv420p" -r $FPS -c:v libx264 -crf 18 -pix_fmt yuv420p "$T/$n.mp4"
  seg "$T/$n.mp4"
}
# a gameplay shot from its frame folder, optional fade in/out (seconds)
shot() { # name fadeIn fadeOut
  local n=$(printf %03d $i); i=$((i+1))
  local frames=$(ls "$F/$1" | wc -l | tr -d ' ')
  local dur=$(python3 -c "print($frames/$FPS)")
  local vf="scale=1600:900,format=yuv420p"
  [ -n "$2" ] && [ "$2" != "0" ] && vf="$vf,fade=t=in:st=0:d=$2"
  [ -n "$3" ] && [ "$3" != "0" ] && vf="$vf,fade=t=out:st=$(python3 -c "print($dur-$3)"):d=$3"
  ffmpeg -v error -y -framerate $FPS -i "$F/$1/%05d.jpg" -vf "$vf" -r $FPS -c:v libx264 -crf 18 -pix_fmt yuv420p "$T/$n.mp4"
  seg "$T/$n.mp4"
}
# a slice of one of the vision videos (8 fps source → 30 fps with slow zoom-in), fade in/out
vision() { # file start secs
  local n=$(printf %03d $i); i=$((i+1))
  ffmpeg -v error -y -ss "$2" -t "$3" -i "$SRC/$1" -vf "scale=1600:900:force_original_aspect_ratio=increase,crop=1600:900,minterpolate=fps=$FPS:mi_mode=blend,fade=t=in:st=0:d=0.8,fade=t=out:st=$(python3 -c "print($3-0.8)"):d=0.8,format=yuv420p" -r $FPS -c:v libx264 -crf 18 -pix_fmt yuv420p "$T/$n.mp4"
  seg "$T/$n.mp4"
}

card title 4
vision citadel.mp4 0 7
card vision 4
card chunk1 3
shot pine-trail 0.5 0
shot pine-hollow 0 0
shot pine-ridge 0 0.6
card chunk2 3
shot pier-walk 0.5 0
shot planet 0 0
shot boars 0 0
shot combo 0 0
shot swim 0 0
shot dive 0 0.4
shot stairs 0.4 0
shot bridge 0 0
shot lookout 0 0
shot wreck 0 0
shot shrine 0 0.5
card built 3.5
shot hero 0.6 1.0
card end 6

ffmpeg -v error -y -f concat -safe 0 -i "$T/list.txt" -c copy "$T/video.mp4"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$T/video.mp4")
echo "video: ${DUR}s"

# score: a low drone (55 + 82.4 Hz, slow tremolo) + surf swells (band-passed pink noise, ~7 s period) + a soft 4/4 pulse at 84 bpm
ffmpeg -v error -y -f lavfi -i "sine=frequency=55:duration=$DUR" -f lavfi -i "sine=frequency=82.41:duration=$DUR" -f lavfi -i "anoisesrc=color=pink:duration=$DUR:seed=7" -f lavfi -i "sine=frequency=110:duration=$DUR" \
  -filter_complex "[0]volume=0.22[a];[1]volume=0.14,tremolo=f=0.11:d=0.5[b];[2]bandpass=f=420:w=380,volume='0.05+0.05*sin(2*PI*t/7.3)':eval=frame[c];[3]volume='0.10*max(0,sin(2*PI*t*84/60))*max(0,sin(2*PI*t*84/60))':eval=frame,lowpass=f=300[d];[a][b][c][d]amix=inputs=4:normalize=0,lowpass=f=2400,afade=t=in:st=0:d=3,afade=t=out:st=$(python3 -c "print($DUR-5)"):d=5,volume=0.9" \
  -c:a aac -b:a 160k "$T/score.m4a"
ffmpeg -v error -y -i "$T/video.mp4" -i "$T/score.m4a" -c:v copy -c:a aac -b:a 160k -shortest -movflags +faststart "$OUT"
echo "wrote $OUT ($DUR s)"; rm -rf "$T"
