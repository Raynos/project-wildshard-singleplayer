#!/usr/bin/env bash
# wan-vace-inputs.sh — build Wan VACE control inputs from the CT1 blockout (TRAILERS CT1 #8, E466).
#
#   wan-vace-inputs.sh --depth depth.mp4|depth/%04d.png --out <dir> [--key key.png] [--fps 12] [--frames 73]
#                      [--size 864x480] [--levels 120:250] [--edges grey/%04d.png]
#
# --levels LO:HI stretches depth LO..HI to 20..255 with one fixed curve for the whole shot (sky = 0 stays 0): the CT1
# depth pass puts the whole grid in 130..247, too flat for VACE to see the lattice.
# --edges adds Canny edges of the grey render on top of the depth (lighten blend): the lattice walls are nearly flat,
# so depth alone does not carry them (community practice: depth + canny beats depth alone in VACE).
#
# Writes <dir>/control.mp4: the depth pass resampled to exactly --frames at --fps (73 @ 12 fps = the whole 6 s shot)
# and cropped/scaled to --size. VACE reads a control video with NO mask as all-white = "follow this structure".
# With --key it also writes the first-frame-anchored pair:
#   <dir>/anchored.mp4  frame 0 = the keyframe, frames 1.. = depth
#   <dir>/anchored-mask.mp4  frame 0 black (keep), frames 1.. white (generate from the depth)
# which mlx-gen's VACE route takes as --video-path anchored.mp4 --video-mask-path anchored-mask.mp4.
set -euo pipefail
depth=""; key=""; out=""; fps=12; frames=73; size=864x480; levels=""; edges=""
while [ $# -gt 0 ]; do
  case "$1" in
    --depth) depth="$2"; shift 2 ;;
    --key) key="$2"; shift 2 ;;
    --out) out="$2"; shift 2 ;;
    --fps) fps="$2"; shift 2 ;;
    --frames) frames="$2"; shift 2 ;;
    --size) size="$2"; shift 2 ;;
    --levels) levels="$2"; shift 2 ;;
    --edges) edges="$2"; shift 2 ;;
    -h|--help) sed -n '2,19p' "$0"; exit 0 ;;
    *) echo "wan-vace-inputs: unknown arg $1" >&2; exit 2 ;;
  esac
done
[ -n "$depth" ] && [ -n "$out" ] || { sed -n '2,19p' "$0"; exit 2; }
mkdir -p "$out"
w=${size%x*}; h=${size#*x}
inp=(-i "$depth"); case "$depth" in *%*) inp=(-framerate 24 -i "$depth") ;; esac
src_frames=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "${inp[@]:0:${#inp[@]}-2}" "$depth")
# Spread the source evenly over the output frames (first → first, last → last), whatever the source length.
step=$(python3 -c "print(($src_frames-1)/max($frames-1,1))")
vf="select='isnan(prev_selected_t)+gte(n\,prev_selected_n+$step-0.001)',setpts=N/($fps*TB)"
scale="scale=$w:$h:force_original_aspect_ratio=increase,crop=$w:$h"
enc=(-c:v libx264 -crf 8 -preset fast -pix_fmt yuv420p -r "$fps")
lut=""
if [ -n "$levels" ]; then lo=${levels%:*}; hi=${levels#*:}
  lut=",format=gray,lut=c0='if(lt(val\,$((lo/2)))\,0\,clip((val-$lo)*235/($hi-$lo)+20\,0\,255))',format=rgb24"; fi
if [ -n "$edges" ]; then
  einp=(-i "$edges"); case "$edges" in *%*) einp=(-framerate 24 -i "$edges") ;; esac
  ffmpeg -v error -y "${inp[@]}" "${einp[@]}" -filter_complex \
    "[0:v]$vf$lut,$scale,format=gray[d];[1:v]$vf,$scale,format=gray,edgedetect=low=0.08:high=0.2,lut=c0='val*0.8'[e];[d][e]blend=all_mode=lighten,format=rgb24[v]" \
    -map "[v]" -frames:v "$frames" "${enc[@]}" "$out/control.mp4"
else
  ffmpeg -v error -y "${inp[@]}" -vf "$vf$lut,$scale" -frames:v "$frames" "${enc[@]}" "$out/control.mp4"
fi
got=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$out/control.mp4")
echo "control.mp4: $got frames @ $fps fps, ${w}x$h (source $src_frames frames, step $step)"
if [ -n "$key" ]; then
  ffmpeg -v error -y -loop 1 -i "$key" -i "$out/control.mp4" -filter_complex \
    "[0:v]fps=$fps,$scale,trim=end_frame=1,setpts=PTS-STARTPTS[k];[1:v]trim=start_frame=1,setpts=PTS-STARTPTS[d];[k][d]concat=n=2:v=1[v]" \
    -map "[v]" -frames:v "$frames" "${enc[@]}" "$out/anchored.mp4"
  ffmpeg -v error -y -f lavfi -i "color=black:s=${w}x$h:r=$fps:d=1" -f lavfi -i "color=white:s=${w}x$h:r=$fps:d=$frames" \
    -filter_complex "[0:v]trim=end_frame=1,setpts=PTS-STARTPTS[a];[1:v]trim=end_frame=$((frames-1)),setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1[v]" \
    -map "[v]" -frames:v "$frames" "${enc[@]}" "$out/anchored-mask.mp4"
  echo "anchored.mp4 + anchored-mask.mp4: frame 0 = $(basename "$key"), frames 1..$((frames-1)) = depth"
fi
