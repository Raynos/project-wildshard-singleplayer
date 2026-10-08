#!/usr/bin/env bash
# av.sh shot <name> | rec <name> | stop <name> [maxSeconds] [startOffset]   (U from env or ./udid)
S=/private/tmp/claude-501/-Users-raynos-projects-games-wildshard-singleplayer/81cffee4-70d4-4229-8860-2e3743d9c0b8/scratchpad/pt3
OUT=/Users/raynos/projects/games/wildshard-singleplayer/art/playtest/round-3-2026-10-08
U="${U:-$(cat $S/udid)}"
case "$1" in
  shot)
    xcrun simctl io "$U" screenshot --type=png "$S/raw-$2.png" >/dev/null 2>&1
    ffmpeg -loglevel error -y -i "$S/raw-$2.png" -vf scale=603:-1 -q:v 4 "$OUT/$2.jpg" && rm -f "$S/raw-$2.png"
    ls -la "$OUT/$2.jpg" | awk '{print $5, $9}';;
  rawshot)
    xcrun simctl io "$U" screenshot --type=png "$S/raw-$2.png" >/dev/null 2>&1; echo "$S/raw-$2.png";;
  rec)
    nohup xcrun simctl io "$U" recordVideo --codec=h264 --force "$S/rec-$2.mov" > "$S/rec-$2.log" 2>&1 &
    echo $! > "$S/rec-$2.pid"; sleep 1; echo "rec pid $(cat $S/rec-$2.pid)";;
  stop)
    kill -INT "$(cat $S/rec-$2.pid)"; sleep 3
    MAX="${3:-40}"; SS="${4:-0}"
    ffmpeg -loglevel error -y -ss "$SS" -t "$MAX" -i "$S/rec-$2.mov" -an -vf "scale=540:-2,fps=24" -c:v libx264 -preset slow -b:v 750k -maxrate 1000k -bufsize 2000k -pix_fmt yuv420p -movflags +faststart "$OUT/$2.mp4"
    ls -la "$OUT/$2.mp4" | awk '{print $5, $9}'
    ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/$2.mp4";;
  keepraw) ;;
esac
