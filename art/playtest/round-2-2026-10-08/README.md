# Agent playtest, round 2 (2026-10-07 evening / 10-08 UTC)

The daily agent playtest (SHARD-PLATFORM G222, SF60), run before Jake plays. It covers production in phone portrait.

## (a) Builds, setup, and what was and wasn't tested

- **Builds.** I ran two production builds, and every finding below is tagged with the build it came from.
  - **`bf396ec-muyyjsyh`** (`/version.json` at the start, time `2026-10-08T03:09:33Z`). The first Driftwood → Pine →
    Nalati drive, the first crash, the boulevard and Driftwood checks, and Pine and Nalati 30 s each were on this build.
  - **`a661ceb-muyzs6yu`** (`/version.json` after the coordinator's note, time `2026-10-08T03:44:05Z`). The title
    showed "NEW BUILD · TAP TO UPDATE", and tapping it loaded A661CEB. On this build I drove Driftwood → Pine → Nalati
    again, one continuous 163 s run, and reproduced the crash. Sky Reach, Template-2, the SE open plot, the SE
    roundabout and SHARD SELECT Pine / Nalati were also on this build. a661ceb adds the far proxy's rock-cliff face
    (`cef433b`), neighbour doors, Nalati day light, Template 1 pass 2 and the Nine Dragon portals.
- **Capture.** One agent-browser session through `scripts/browser-lane.sh wait`, emulating an "iPhone 16 Pro" (402 × 874,
  3×) at `?touch=1&tier=phone&mute=1` (harness params only), with `--mute-audio` and Settings ▸ Developer ON. Hover was
  switched on with the real HOVER button. The driver steers the yaw toward waypoints and holds `move.forward`, like a held
  joystick. It never teleports. A stuck is logged after 3–5 s with no progress. Clips are agent-browser recordings
  (402 px CSS width) scaled to 540 px, 15 fps, muted, ≤ 3.5 MB. Headless rendering is capped at 30 fps.
- **Grid layout seen.** Driftwood (0,0) is home, Pine Hollow is (0,1), Nalati is (1,0), Template-2 is (1,1), Signal Dunes
  is (−1,0) and Sky Reach is (0,−1). Open plots are NW / SW / SE. The cell pitch is 555 m, and the boulevard runs at ±277.5.
- **Tested:** the menu, What's New and Settings; INFINITE WILDSHARD's cold load; Driftwood S-pier out → boulevard → Pine S
  in → Pine 30 s → Pine E out → boulevard → Nalati W in → Nalati 30 s+ → Nalati W out (on both builds); Driftwood N in and
  N out (the round-1 pier); Pine re-entry (3 tries); the Sky Reach N entry and its cell screen up close; Template-2 W
  entry to its centre; the SE open plot's N entry to its middle; a 360° look at the SE inner roundabout; and SHARD SELECT
  ▸ Pine and ▸ Nalati, 30 s each.
- **Not tested:**
  - Real-iPhone memory, tab kills, throttling and audio.
  - Signal Dunes and Sky Reach interiors: both are still refused.
  - The Rising Islet: I couldn't reach it (#8).
  - Nine Dragon portals: Nine Dragon has no cell in this layout.
  - The NW / SW plots, the outer ring and the outer corners.
  - Round-1's Nine Dragon grey void and the Sky Reach "8 M" chip (SHARD SELECT, not re-run).
- **Falls:** 0. **Stucks:** 2, and neither is a bug: a palm and rock line when crossing Driftwood straight north from
  the S pier, and Sky Reach's soft wall.

## (b) Round-1 problems: status

| # | Round 1 | Now | Evidence |
|---|---|---|---|
| 1 | Only Driftwood (+ templates) enterable | **Fixed for Pine and Nalati** (Developer, both builds). Signal Dunes and Sky Reach still show "WAITING · NOT READY FOR GRID · ENTER THROUGH SHARD SELECT". | clip-01, clip-02, clip-08, 08-… |
| 2 | Cell screen turns into a black wall of giant text up close | **Fixed.** At Sky Reach the soft wall stops the board at z −284.5 and the screen stays readable. New problem: Nalati's screen flashes even when Nalati is loaded (#5). | clip-08, 08-a661-sky-reach-screen-up-close-readable.jpg |
| 3 | Pine's memory warning covers a third of the screen | **Fixed.** It is now a chip, "MEMORY LIMIT · +273.2 MB ▾". Pine alone is **still 273.2 MB over**, the same as round 1, though What's New says "Pine Hollow: lighter on memory". The chip sits over the "NAMED ELITE NEARBY" banner. | 14-a661-ss-pine-memory-chip.jpg, clip-12 |
| 4 | 100 m grey walls in the far view | **Better, same scale.** On bf396ec they are white streaked walls along the boulevard. On a661ceb Nalati's road face is brown rock, but it is still a ~100 m flat cliff. A dark striped slab stands at the SE roundabout corner, and Pine and Nalati are pale, untextured mountains on approach. | 05-bf396ec-boulevard-white-wall.jpg, 16-a661-se-roundabout-four-ways.jpg, clip-11 |
| 5 | Templates barren | **Slightly better.** The gate and title now read "TEMPLATE SHARD · 2", and a few low district blocks stand in the distance. The centre is still a white grid plane, and a creature took me from 100 to 21 HP while I stood there looking. | clip-09, 09-a661-template2-centre-four-ways.jpg |
| 6 | Stuck on Driftwood's north pier | **Fixed.** N out climbs the pier cleanly. | clip-07 |
| 7 | Camera inside the template hub block at speed | **Not reproduced.** Inside a cell the board is capped at 14 m/s, I drove to the centre with no snag, and there is no block at the centre any more. | clip-09 |
| 8 | Grid memory 908–938 / 1000 | **Worse in numbers, as G216 allows.** The grid reads **2331–2360 / 1000 MB** with Pine and Nalati admitted, and 922 with only Driftwood. It also thrashes (#4). | 03-bf396ec-grid-arrival-pts-2331mb.jpg, clip-04 |
| 9 | Sky snaps at crossings | **Worse.** Each crossing now freezes for seconds on a flat beige (Pine) or white (Nalati) frame, and then the shard's sky appears in one step (#2). | clip-01, clip-14, 06-… |
| 10 | Small UI faults | `&amp;` **fixed** (02-…). EXPLORE WORLD overlap **fixed** (13-…). Template identity **fixed**. The minimap's "SKY REACH" label is correct: Sky Reach is the south neighbour. The loading tagline is unchanged. The Nine Dragon void and the Sky Reach chip were not re-run. | |

## (c) Top 10 problems now (worst first)

1. **Re-entering Pine Hollow crashes the game: "SOMETHING BROKE · The game hit an error it can't recover from".**
   - **Builds:** bf396ec and a661ceb.
   - **Repro:** 2 crashes in 3 re-entries. Each time, Pine had been unloaded and re-admitted on the road before I came
     back in. The one clean re-entry was a quick Pine → Driftwood → Pine inside 15 s.
   - **Console:** `[faults] system "engine.events" threw: Duplicate system id: engine.player.for`, then
     `TypeError: Cannot read properties of undefined (reading 'width')` in three.js `setTexture2D` → `upload`, three
     times, then "core system render failed 3 times: the frame loop stops".
   - **Recovery:** RELOAD HERE resumed in Pine at the same spot.
   - **Where:** Pine S entry (0, 305).
   - **Files:** `clip-03-a661-pine-reentry-crash.mp4`, `10-bf396ec-crash-reentering-pine.jpg`,
     `11-bf396ec-crash-details.jpg`, `12-a661-crash-details.jpg`.
   - **Likely code:**
     - `src/engine/player/CameraFX.ts:33`: `CameraFX.for` registers the update system `engine.player.for` once per Game,
       so a second install throws.
     - A texture whose source was released (`gpuOnlyTexture`, `src/engine/core/gpuOnly.ts:68`) is re-uploaded after the
       cold unload and re-admit (`src/game/grid/live.ts` `retireColdRegions`).
   - **Rows:** SF47-g / SF20a (no hitch, nothing lost) / SF18b.
2. **Every crossing into Pine or Nalati freezes for seconds.**
   - **Pine:** a flat beige frame for about 12 s on bf396ec and about 6 s on a661ceb ("fps paused").
   - **Nalati:** a white, untextured world for 3–6 s, then a sky over an empty white ground for a moment, then the
     shard.
   - The shard's title card plays over the frozen frame. SF22's gate is "a hybrid neighbour's install at a crossing ≤ one
     33 ms frame".
   - **Where:** Pine S (0, 300) and Nalati W (300, 0).
   - **Files:** `clip-01-a661-pine-crossing-beige-freeze.mp4`, `clip-14-bf396ec-pine-crossing-beige-freeze.mp4`,
     `clip-02-a661-nalati-crossing-waiting-flash.mp4`, `clip-15-bf396ec-nalati-crossing.mp4`,
     `06-a661-pine-crossing-beige-frame.jpg`.
   - **Code:** `src/game/grid/crossing.ts`, `regionalRuntime.ts`.
   - **Rows:** SF22 (R4-S6) / SF20a / G226.
3. **The grid claims 2.3 GB against the 1.0 GB cap from the first frame.**
   - Pine (749) and Nalati (457) are preloaded at boot beside Driftwood (318), XROADS (~235) and the platform (~107).
   - The PTS bar reads "XROADS 233 · 2331.3/1000.0 MB", and the chip reads "MEMORY LIMIT · +1331.3 MB".
   - G216 lets Developer load over budget, but Jake's iPhone will almost certainly kill the tab, and on a phone this
     crashes before #1 does.
   - **Where:** every grid frame on both builds.
   - **File:** `03-bf396ec-grid-arrival-pts-2331mb.jpg`.
   - **Rows:** SF22d / SF47 / SF48 / SF57.
4. **Residency thrash on the boulevard.**
   - Pine, Nalati and Template-2 are dropped to "pending" and re-admitted every 2–3 s while you drive the x = 277.5 road
     beside them.
   - Playing MB swings 2348 → 1811 → 2348 → 1428 → 2342 → 1812 → 2343 → 1464, about 10 swings in 40 s (sampled once a
     second).
   - On a phone that is repeated GPU uploads, and it is the likely set-up for #1.
   - **Where:** both builds, worst on the x = 277.5 road from z −150 to +300 and on the z = 277.5 road.
   - **Files:** `clip-04-a661-boulevard-memory-thrash.mp4` (watch the PTS numbers).
   - **Code:** `src/game/grid/live.ts:286` (`retireColdRegions`' 10 m release band against the radial requests in
     `beforeFixed`).
   - **Rows:** SF18b / G226.
5. **"WAITING · NALATI GRASSLANDS · NOT READY FOR GRID · ENTER THROUGH SHARD SELECT" flashes in your face at Nalati's
   entry, and then lets you in.**
   - The hex soft wall and the refusal card show for about 1 s, even when the PTS bar lists Nalati as resident (thrash,
     #4).
   - **Where:** Nalati W entry, both builds.
   - **Files:** `07-a661-nalati-waiting-screen-at-entry.jpg`, `clip-02`.
   - **Code:** `src/game/grid/cellScreen.ts`, `softWallLook.ts`.
   - **Rows:** SF18b (G217).
6. **The far-view walls are still giant.**
   - **bf396ec:** white, streaked 100 m walls line the boulevard.
   - **a661ceb:** brown rock cliffs, still tall flat faces. A dark striped slab with a pale base stands at the SE
     roundabout. Pine and Nalati are pale grey-white mountains as you drive up to them.
   - **Files:** `05-bf396ec-boulevard-white-wall.jpg`, `16-a661-se-roundabout-four-ways.jpg`, `clip-11`, `clip-01` (first
     seconds).
   - **Code:** `src/game/grid/farProxy.ts`.
   - **Rows:** SF23 / SF17b.
7. **The cold start is long.**
   - INFINITE WILDSHARD took **about 40 s** to playable on bf396ec's first boot: still at "SETUP step 14/16 · Title art"
     at 30 s, "Longest page pause 5.4s at Weapons · HUD".
   - It took 28 s on a661ceb's first boot and 13 s warm. Round 1 took about 8 s.
   - The cause is Pine and Nalati being admitted at boot.
   - **Files:** `04-bf396ec-cold-load-30s-still-loading.jpg`.
   - **Code:** `src/game/grid/boot.ts` / `pageBoot.ts`.
   - **Rows:** SF18b / SF22.
8. **What's New promises things you can't do.**
   - "Sky Reach: ride the Rising Islet up from the road (Developer)": Sky Reach is still "WAITING · NOT READY FOR GRID",
     and its soft wall stops you on the boulevard at z −284.5. Signal Dunes is the same.
   - "Nine Dragon: north lantern lift (Developer)" is still listed on a661ceb, but G224 replaced the lift with portals.
   - **Files:** `01-bf396ec-whats-new.jpg`, `clip-08`.
   - **Rows:** SF49, SF51, SF60 (the card).
9. **The hoverboard glides about 150 m after you let go at 30 m/s.**
   - Measured: released at x = 40 on the boulevard, stopped at x = −108, 148 m later.
   - It overshoots every turn-in, and it carried me back into Pine, which set up crash #1.
   - **Where:** any boulevard stop.
   - **Code:** `src/engine/player/Player.ts`, `src/game/grid/rules.ts`.
   - **Row:** SF20d.
10. **Small faults, in one batch:**
    - Grid Nalati is a yellow steppe under a sunset sky, while SHARD SELECT Nalati is lush green
      (`21-bf396ec-nalati-in-grid.jpg` vs `17-a661-ss-nalati.jpg`; SF48).
    - Nalati's grass grows through the 15 m entry asphalt (`19-…`; SF48 / G103).
    - A black band crosses Nalati's horizon looking north (`22-…`).
    - The screen goes near black for about 3 s hovering through Pine's forest at (100–140, 555) (`18-…`; SF47).
    - In Pine alone, the memory chip covers the "NAMED ELITE NEARBY" banner (`14-…`;
      `src/game/grid/memoryWarning.css`).
    - The red PTS bar still spans the top third and is unreadable to a player (SF38).
    - In the open plot, the ground is a black void with cyan grid lines, and a blank grey billboard stands at the horizon
      in every direction (`15-…`, `clip-10`; `src/game/grid/openPlot.ts`, G198 / G219).
    - The loading card still says "A world that does not exist yet, arriving one chunk at a time."

## (d) What works now

- **Driftwood → Pine → Nalati can be driven** in Developer, on both builds. The a661ceb run went Driftwood S out → Pine S
  in → Pine E out → Nalati W in → Nalati W out in 163 s with 0 stucks and 0 falls. Each entry shows its title card
  ("PINE HOLLOW · BOREAL PINE FOREST", "NALATI GRASSLANDS · ALPINE STEPPE"), and each exit restores SAFE ZONE and the
  road.
- **Inside, both shards are alive.**
  - Pine has its forest, the Ghost Stag and Old Ironhide name plates, and "FIND THE RANGER".
  - Nalati has its painterly sky, Argymaq the Unbroken and "TULPAR".
  - Hovering for 30 s in each is clean (`clip-05`, `clip-06`, `20-…`, `21-…`).
- **Driftwood's north pier is fixed** (`clip-07`). Refused cells now stop you at a readable screen (`clip-08`).
- **The memory warning is a small chip** instead of a panel (`14-…`).
- **Templates carry their instance number.** The SE open plot shows its showroom: "WHAT WOULD YOU BUILD?" picture cards,
  "THIS PLOT IS YOURS TO BUILD", "500 × 500 M · 4 ENTRIES" (`clip-10`).
- **SHARD SELECT:** Pine and Nalati each load alone in about 7 s and play cleanly for 30 s (`clip-12`, `clip-13`). Nalati
  alone shows no memory warning.
- **Crash recovery works:** RELOAD HERE resumed the run in Pine at the crash spot. Settings' `&amp;` and the SHARD SELECT
  overlap are gone.
