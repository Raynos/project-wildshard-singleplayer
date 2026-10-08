# Agent playtest, round 3 (2026-10-08 evening): iOS Simulator Safari

This is the daily agent playtest (SHARD-PLATFORM G222 / SF60), run before Jake plays. Under G243 it ran in the iOS
Simulator's real Safari (WebKit) first. It covers production in phone portrait.

## (a) Builds, setup, and what was and wasn't tested

- **Builds**
  - **`ab39c40-mv00z0fi`** covers almost the whole run (`/version.json` at the start, time `2026-10-08T21:05:08Z`).
    - Production deployed **`9ee6df47-mv03eqdm`** at 22:13 UTC, during the run. Safari kept serving ab39c40 from its
      service worker (`main-BhFM40tm.js`) until I cleared it.
    - Every finding not tagged otherwise is from ab39c40.
  - **`9ee6df47`** got a re-check at the end: the grid cold load and spawn (E463), the Template-2 freeze, and SHARD
    SELECT Nalati LEGACY. Its files are tagged `9ee6`. 9ee6df47 contains the E463 fix `c6daff06e`.
- **Device**
  - An iPhone 17 Pro Simulator through `scripts/sim-lane.sh`. Safari reports iOS 18.7 and Safari 26.5.
  - It ran as a Safari tab, not a home-screen PWA, so the URL bar is visible in the shots.
  - Settings ▸ Developer ON and volume 0 were set with the save fixtures (`scripts/debug-settings.mjs`).
  - It was driven over Web Inspector (`ios_webkit_debug_proxy`, `tools/ctl.mjs`).
  - **Taps** are DOM pointer events on the real buttons: INFINITE WILDSHARD, SHARD SELECT, the cards, LEGACY /
    SHARDFILE, HOVER, the minimap, LANTERN.
  - **Movement** steers the yaw and holds `move.forward` like a held joystick (`tools/pt.js`). There are no teleports.
  - Clips are `simctl recordVideo` at 540 px wide, 24 fps, muted.
- **Lane incident:** halfway through, another agent's `sim-lane.sh run` took over the shared `wildshard-iphone` device
  (the SF0d same-UDID case), and my session was lost.
  - I re-leased a private device, `pt3-iphone`: a fresh Safari with a warm title only. I deleted it afterwards.
  - SHARD SELECT timings are therefore first visits on that device.
- **Tested in Safari**
  - Title and What's New.
  - **INFINITE WILDSHARD:** a cold load and a warm load. One continuous drive on hover:
    - Driftwood S pier → ring road → Pine S in → 30 s inside Pine.
    - Pine E out → the x = 277.5 road → Nalati W in → 30 s inside Nalati.
    - Nalati W out → Driftwood E in.
    - Driftwood E out → road → Template-2 W in, with HOVER tests and the MAP.
    - Template-2 out → road → the SE open-plot showroom.
    - Sky Reach N in (a warm grid).
  - **SHARD SELECT:** the buttons on all 7 cards. SHARDFILE loads of Driftwood, Pine, Nalati and the template (with
    time to playable). LEGACY loads of Nalati and Pine.
- **Not tested**
  - Real-iPhone memory, tab kills, fps and throttling: the Simulator runs on the Mac.
  - Audio.
  - Standalone PWA mode.
  - Riding the Rising Islet (#8).
  - Signal Dunes, Nine Dragon, and the NW / SW plots.
  - Pine re-entry (round 2's crash): this time I re-entered Driftwood only.
  - Chromium backup: my script picked the wrong cards, so all 3 shots are Driftwood. It only shows that Chromium on 9ee6
    draws Driftwood's minimap with the island.
- **Falls:** 1 (Sky Reach, #8). **Stucks:** 2, both under Driftwood's pier on ab39c40 (E463). **Page errors:** 0.
  **Crashes:** 0.

## (b) Jake's phone reports: status

| Report | Status in Simulator Safari | Evidence |
|---|---|---|
| HOVER on the road and in the template (E459) | **Fixed.** HOVER shows and toggles off and on: on the road (y 0.02 ↔ 0.46), in grid Template-2, and in SHARD SELECT's template. Hover then drives normally. | `07-road-hover-on-grid-dawn-sky.jpg`, `16-template2-inside.jpg`, `17-…`, `30-ss-template-hover-on.jpg`, `clip-07` |
| Template items black (E460) | **Better, not clearly right.** The held item is no longer pure black. It reads as a flat, unshaded dark-grey slab at the right edge. Tapping LANTERN showed no lantern in view, and no whip swing was visible. | `27-…`, `28-…`, `29-…`, `clip-07` |
| Loading screen shows name and progress from the first paint (E458) | **Fixed for the name, clock and tier:** the first frame reads "LOADING CHUNK · DRIFTWOOD ISLE 00:00.1". Progress still parks for long stretches (#7). | `04-grid-loading-first-paint-name.jpg`, `05-…`, `clip-01` |
| INFINITE WILDSHARD spawns under the pier (E463) | **ab39c40: not fixed, 2 of 2 loads.** The spawn is at (0, −0.85, −194) under the deck. Walking can't leave in any direction, and hover gets out only to the north. **9ee6df47: fixed.** The spawn stands on the deck at y 1.21. | `03-…`, `34-…`, `clip-01`, `clip-02`, `41-9ee6-grid-spawn.jpg`, `clip-10` |
| The template's minimap and map (SF66) | **Fixed.** Grid Template-2's minimap and SHARD SELECT's template minimap show the baked district map. The grid MAP draws the template cell. | `16-…`, `27-…`, `18-template2-map.jpg` |
| Sky Reach's minimap (G252b) | **Fixed.** It shows islands and bridges on the dark void, with no cloud sea or tint. | `35-…`, `38-…` |

## (c) Top 10 problems now (worst first)

1. **Template cells freeze for 1.0–1.6 s every ~6.2 s.**
   - It happens standing still or driving, on both builds. ab39c40: 1447, 1030, 1028, 1062, 992 ms… 9ee6: 1166–1627 ms,
     the last 10 in a row.
   - I checked it with nothing polling the page, and it is not seen in Driftwood, Pine, Nalati or on the road.
   - Without Developer, **every grid neighbour is a template**, so Jake lives in this.
   - **Where:** grid Template-2, (555, 555).
   - **Files:** `clip-11-9ee6-template2-1.5s-freeze-every-6s.mp4` (watch the fps chip), `16-template2-inside.jpg`.
   - **Rows:** SF52 / SF62, possibly the same periodic doubled frame as SF69.
2. **Every crossing waits 6–14 s on a blank placeholder world, with main-thread freezes.** (Round 2 showed the same.)
   - **Pine S:** about 12 s of flat beige ground and grey cones, with "fps paused".
   - **Nalati W:** about 10 s of white-green blur plus a black frame, with freezes of 537, 829, 628 and 1518 ms.
   - **Driftwood E re-entry:** about 6 s, with a 1637 ms freeze.
   - **Sky Reach N:** about 14 s, with an 1807 ms freeze. A 2195 ms freeze also hit inside Pine near its east exit.
   - **Files:** `clip-03-…`, `clip-04-…`, `09-…`, `13-…`.
   - **Code:** `src/game/grid/crossing.ts`, `regionalRuntime.ts`.
   - **Rows:** SF22 (one 33 ms frame) / SF20a / SF67.
3. **Pine and Nalati alone are over the 1.0 GB cap.**
   - Readings:
     - Pine: 1083–1152 / 1000 MB ("PINE HOLLOW 494 % OF BUDGET").
     - Nalati: 1072–1145 MB (457 %).
     - Driftwood: 907–910 MB (322 %).
     - Sky Reach: 784–977 MB.
     - Template-2: 551 MB. The road: 527 MB.
   - The chip reads "MEMORY LIMIT · +152.5 MB".
   - This is far better than round 2's 2.3 GB, but on the iPhone it is still tab-kill territory (G244).
   - **Files:** `08-…`, `11-…`.
   - **Rows:** SF47 / SF48 / SF57 / SF22d.
4. **At a crossing the camera sits *inside* the cell's loading card for 7–15 s.**
   - Giant "LOADING · step 4/4 · ready · LOADING · 100%" text with the build id covers the view, over a dark placeholder.
   - It happens at the Driftwood E re-entry (about 7 s) and the Sky Reach N entry (about 15 s). This is round 1's #2
     coming back.
   - **Files:** `clip-05-…`, `clip-09-…`, `15-…`, `36-…`.
   - **Code:** `src/game/grid/cellScreen.ts`.
   - **Rows:** SF18b (G217) / SF22.
5. **Nalati's LEGACY entry, the public way in, renders wrong in Safari.**
   - Rectangular sky-backdrop panels float in the landscape, the boulders and rock chips are black, and the ground and road
     are darkened. A 360° look confirms it.
   - It persists after 10 s and on 9ee6.
   - SHARDFILE Nalati (`31-…`) and grid Nalati (`11-…`) look right.
   - **Files:** `clip-08-…`, `32-…`, `32b-…`, `42-9ee6-ss-nalati-legacy.jpg`.
   - **Rows:** SF65 / SF48 / SF63. This is G244's "black materials" class.
6. **Minimaps are blank in Safari while the full MAP is right.**
   - **Driftwood**, grid and SHARD SELECT: a dark disc with a blurred blob, even on the beach (`06-…`, `24-…`).
   - **SHARD SELECT Pine and Nalati**, LEGACY and SHARDFILE: a black disc (`25b-…`, `31-…`, `32-…`, `33-…`).
   - The grid's Pine, Nalati, template and Sky Reach minimaps draw. Chromium on 9ee6 draws Driftwood's.
   - **Code:** `src/engine/ui/Minimap.ts`.
   - **Row:** SF66.
7. **Loading is slow and the bar parks.**
   - **Grid cold:** about 22 s to control, including the arrival cinematic, and 16 s warm. It sat at "SETUP step 13/16 ·
     Weapons · HUD 61 %" for about 12 s ("Longest page pause 3.3 s at Weapons · HUD").
   - **SHARD SELECT SHARDFILE, time to playable:**
     - Driftwood: 15.0 s, with Shaders parked at 88 % for 6.5 s.
     - **Pine: 36 s**, with Shaders parked at 84 % for 13.7 s.
     - Nalati: 18 s.
     - Template: 13 s. Its line shows raw hashes ("Fetching 8655f5da0dca").
   - **LEGACY, warm:** Nalati 5.3 s, Pine 10.3 s.
   - **Files:** `05-…`, `clip-01`, `tools/summ.py` logs.
   - **Row:** SF67.
8. **Sky Reach (grid, Developer) is now enterable, but driving straight in from the N entry drops you off the lip.**
   - About 50 m in, you fall into the cloud sea: "FELL TOO FAR · RESPAWNING AT THE SOUTH GATE".
   - No gate stopped me and no islet ride was offered on that line. The loading card (#4) hid the entry for 15 s.
   - I couldn't ride the Rising Islet.
   - **Files:** `clip-09-…`, `37-…`, `38-…`.
   - **Code:** `src/shards/far-reach/world/islets.ts`.
   - **Row:** SF49 (G183).
9. **The grid MAP shows YOU in Driftwood's cell while you are in Template-2.**
   - The arrow is drawn at your local coordinates in the centre cell.
   - The header still reads "BAG · DRIFTWOOD ISLE", over a Nalati quest.
   - Labels collide: "DRIFTWOOD ISLE" over "THE RIDGE", and "THE PIER" over "SKY REACH".
   - The map draws Nalati to the left and Signal Dunes to the right. Check the east-west orientation.
   - **File:** `18-template2-map.jpg`.
   - **Row:** SF66.
10. **Pine Hollow's near trees draw as bare black branch skeletons in Safari.**
    - This is true in the grid, LEGACY and SHARDFILE, with only a few green trees in the distance (`08-…`, `25-…`, `33-…`).
    - Round 2's Chromium shots show Pine in full foliage, which points to Safari foliage cards (alpha). It is unconfirmed
      because the Chromium backup failed.
    - **Rows:** SF47 / SF63.

**Small faults, in one batch:**
- In the template, the coin chip overlaps the JOURNAL button (`27-…`). SHARD SELECT's template card thumbnail is a blank
  grey placeholder (`21-…`).
- Pine and Nalati's far proxies are still flat grey cones (`10-…`).
- World nameplates clip at the screen edge ("RGYMAQ", "HE GHOST STAG").
- The hover glides about 60 m after release on the road, down from 150 m in round 2.
- What's New now lists the Sky Reach islet as a SHARD SELECT feature (`02-…`).

## (d) What works now

- **Driftwood → Pine → Nalati → Driftwood → Template-2 → open plot → Sky Reach** drives in one session with 0 crashes and
  0 page errors. Each exit restores SAFE ZONE and the road.
- **Boot memory** is 909 MB, down from 2331: Pine and Nalati are no longer preloaded.
- **No residency thrash on the road.** The x = 277.5 road from z 555 to −555, past Nalati and Template-2, holds at
  527–534 MB with no residents. Round 2's #4 is fixed.
- **The Nalati and Driftwood gates** now show a progress card ("LOADING · NALATI GRASSLANDS · step 3/4 · colliders ·
  75 %") instead of "WAITING · NOT READY". Sky Reach admits in the grid (`12-…`).
- **Inside, both shards look right in the grid.** Nalati is lush, with Argymaq and TULPAR. Pine has snow, the Ghost Stag
  and FIND THE RANGER, with its baked minimap.
- **Small wins:**
  - The grid-dawn road sky (G242, `07-…`).
  - The open plot's showroom ring ("INK VALLEY", "FLOATING ISLAND RACE", `clip-06`).
  - A steady 30 fps cap.
- **SHARD SELECT's SF65 buttons are correct on all 7 cards:**
  - Driftwood, Pine and Nalati show LEGACY and SHARDFILE.
  - Nine Dragon, Signal Dunes and Sky Reach show SHARDFILE "NOT YET" (disabled).
  - The template shows LEGACY "SHARDFILE ONLY · NO LEGACY" (disabled).
  - Every enabled entry loads.
- **The full MAP draws the baked images** for Driftwood, Pine and the grid.
- **E463 is fixed** on 9ee6df47.

## Files

- Stills `01-…42-…`, clips `clip-01…clip-11`.
- `tools/`: the Simulator Safari driver.
  - `ctl.mjs`: evaluate in the page over Web Inspector.
  - `pt.js`: snapshots, the held-joystick route driver, HOVER taps.
  - `watch.mjs` / `loadsnap.js`: a loading-screen poller.
  - `ss.sh`: timed SHARD SELECT entries.
  - `av.sh`: shots and recordings.
  - `summ.py`: summarises the loading logs.
