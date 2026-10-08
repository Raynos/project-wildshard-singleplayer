#!/usr/bin/env bash
# ss.sh <cardIndex> <legacy|shardfile> <name>: SHARD SELECT → load, timed; leaves the shard running and the recording on
S=/private/tmp/claude-501/-Users-raynos-projects-games-wildshard-singleplayer/81cffee4-70d4-4229-8860-2e3743d9c0b8/scratchpad/pt3
cd "$S" || exit 1
I="$1"; MODE="$2"; N="$3"
node ctl.mjs 'location.replace("/"),1' >/dev/null
for i in $(seq 1 60); do r=$(node ctl.mjs --timeout=3 '!!document.querySelector(".ws-main-select")'); [ "$r" = "true" ] && break; sleep 1; done
node ctl.mjs 'document.querySelector(".ws-main-select").click(),1' >/dev/null; sleep 2
node ctl.mjs "document.querySelector('.ws-menu-card[data-i=\"$I\"]').click(),1" >/dev/null; sleep 1.2
./av.sh rec "$N" >/dev/null
BTN=".ws-menu-play"; [ "$MODE" = "shardfile" ] && BTN=".ws-menu-shardfile"
node watch.mjs 180 "$S/w-$N.log" 1 &
WP=$!
sleep 1.5
T0=$(python3 -c 'import time;print(time.time())')
node ctl.mjs "(setTimeout(()=>document.querySelector('$BTN').click(),50),1)" >/dev/null
wait $WP
T1=$(python3 -c 'import time;print(time.time())')
echo "tap->loader gone+1.5s wall: $(python3 -c "print(round($T1-$T0-1.5,1))") s"
grep -v TIMEOUT "$S/w-$N.log" | tail -1 | cut -c1-300
