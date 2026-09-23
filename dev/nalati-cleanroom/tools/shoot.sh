#!/bin/bash
# usage: shoot.sh <label> [extra query]   -> shots/<label>-phone.jpg, shots/<label>-desk.jpg and compare-<label>-*.jpg
D="$(cd "$(dirname "$0")/.." && pwd)"  # dev/nalati-cleanroom
S=cleanroom-gfx
L=$1; X=$2; ONLY=$3
cd "$D"
shot() { # w h tier out
  agent-browser --session $S set viewport $1 $2 >/dev/null
  agent-browser --session $S open "${BASE:-http://127.0.0.1:5188/dev/nalati-cleanroom/index.html}?tier=$3&hud=0$X" >/dev/null
  agent-browser --session $S wait --fn "window.__ready === true" --timeout 60000 >/dev/null 2>&1
  agent-browser --session $S wait 2500 >/dev/null
  agent-browser --session $S errors 2>&1 | head -5
  agent-browser --session $S screenshot "$D/shots/$4.png" >/dev/null
  magick "$D/shots/$4.png" -quality 88 "$D/shots/$4.jpg"; rm -f "$D/shots/$4.png"
}
if [ "$ONLY" != "desk" ]; then
shot 390 844 phone "$L-phone"
magick "shots/$L-phone.jpg" -resize 390x844! ref/mockup-1-fp-front.jpg -resize x844 +append -quality 85 "shots/compare-$L-phone.jpg"
fi
if [ "$ONLY" != "phone" ]; then
shot 1600 900 desktop "$L-desk"
magick "shots/$L-desk.jpg" -resize x900 ref/mockup-1-fp-front.jpg -resize x900 +append -quality 85 "shots/compare-$L-desk.jpg"
fi
