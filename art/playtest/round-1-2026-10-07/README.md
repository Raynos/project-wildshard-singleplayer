# Agent playtest, round 1 (2026-10-07)

The daily agent playtest (SHARD-PLATFORM G222, SF60). It's a phone-portrait run done before Jake plays.

## (a) Build, setup, and what was and wasn't tested

- **Build:** `edd505802` (local HEAD when the run started; `/version.json` = `edd5058-muypxx7l`), served from a clean
  `git archive` by `scripts/serve-build.sh --head`. G216 (`f5af1fce3`, Developer admits over-budget shards), G217 (the 3D
  cell screen, `ef6351684` … `4628f2972`) and G220 for Template 1 (`a55e2684f`) are all in this build. G220's proof
  captures (`3a80e3625`) and later commits are not.
- **Capture:** one agent-browser session through `scripts/browser-lane.sh`, emulating an iPhone 16 Pro (402 × 874, 3×) at
  `?touch=1&tier=phone&mute=1`, with audio muted and Settings ▸ Developer ON. Driving used a held-forward input that
  steers toward waypoints, like a held joystick. Hover was toggled with the real HOVER button. The driver never teleports
  when stuck: it logs the spot and moves on. Teleports were used only to frame stills.
- **Tested:** both menu doors (G212) and What's New. In INFINITE WILDSHARD: the reveal; the boulevard on all four sides
  of Driftwood, all four inner roundabouts and part of the outer ring; and these entries:

  | Cell | Entries tried | Result |
  |---|---|---|
  | Driftwood (0,0) | N in, W in + out, S in + out, N out | in/out OK; **N out stuck on the pier** (#6) |
  | Template-2 (1,1) | W in, N in, S out | OK |
  | Template-4 (−1,−1) | E in, N out | OK |
  | Template-6 (1,−1) | W in, N out | OK |
  | Template-1 (−1,1) | E in, S out | OK |
  | Pine Hollow (0,1) | E, S | refused: NOT READY FOR GRID |
  | Nalati (1,0) | W | refused: NOT READY FOR GRID |
  | Signal Dunes (−1,0) | E (×3) | refused: NOT READY FOR GRID |
  | Sky Reach (0,−1) | N | refused: NOT READY FOR GRID |

  In SHARD SELECT, each shard was loaded alone (Driftwood, Pine Hollow, Nalati, Nine Dragon, Signal Dunes, Sky Reach and
  the template) and walked for 30 s each.
- **Not tested:**
  - Real iPhone frame rate, throttling and tab kills. Headless rendering is capped at 30 fps; the readout showed 30 fps /
    33 ms the whole time, with no frame over 70 ms.
  - Audio.
  - G216 admission inside the grid. No neighbour can be admitted at all (see #1), so G216's grid path never runs.
  - Open plots (G198/G219). The Developer layout puts Signal Dunes and Sky Reach on the two non-shard cells, so this
    layout has no open plots.
  - DEVSERVER cells and the Blender Template (not in this build), and Thin Ice (locked draft).
  - Engine-initiated recovery reloads (G185/G209). A plain browser reload inside the grid lands on the menu, which G115
    expects while SF22's gates are false.
- **Falls:** 0 on every leg. **Walk stucks:** only the pier in #6.

## (b) Top 10 problems (worst first)

1. **Only Driftwood loads in the grid; every other real shard is still refused.** Pine Hollow, Nalati, Signal Dunes and
   Sky Reach each show the cell screen with "NOT READY FOR GRID · no shardfile in this build · step 0/4 shardfile · This
   shard has no shardfile yet: it joins the grid in M3 · PLAY IT THROUGH SHARD SELECT". G216 landed, but it can't fix
   this: the blocker is the missing grid shardfile, not the memory budget. A player who drives the grid finds Driftwood
   plus four copies of the template. This is the same problem Jake hit last time.
   Where: Pine E/S, Nalati W, Signal Dunes E, Sky Reach N.
   Files: `clip-04-nalati-not-ready-screen.mp4`, `clip-07-pine-east-blocked.mp4`, `09-nalati-west-not-ready-screen.jpg`,
   `13-pine-east-blocked-screen.jpg`, `14-sunscar-east-screen.jpg`, `06-far-reach-wall-from-road.jpg`.
   Rows: SF47 (Pine), SF48 (Nalati), SF49 (Sky Reach), Signal Dunes' M3 row; the expectation was set by G216 (SF18b).
2. **The cell screen turns into a black wall of huge, unreadable text when you get close.** The G217 screen stands right
   at the soft wall. The hoverboard keeps gliding about 15–20 m after you let go, and a boulevard is only 55 m wide, so
   crossing it or overshooting an exit parks you face-first in a full-screen black panel of giant pixel letters ("0",
   "no s…", "step"). The screen reads well only from about 25–50 m.
   Where: Sky Reach N, Nalati W, Signal Dunes E (after leaving Driftwood W and Template-1 S).
   Files: `clip-02-sky-reach-black-wall.mp4`, `clip-10-driftwood-west-then-overshoot-into-screen.mp4`,
   `10-nalati-wall-up-close-black.jpg`.
   Row: SF18b (G217); the glide length is SF20d.
3. **Pine Hollow alone: the Developer memory warning covers a third of the screen, and Pine is 273 MB over.** The
   "DEVELOPER · MEMORY LIMIT EXCEEDED" panel says PLAYING 1273.2 / 1000.0 MB, OVER 273.2 MB (claim 804.7 MB). It sits in
   the middle right (`max-height: 32vh`) for the whole session, repeats its header in two blocks, can't be dismissed, and
   has `pointer-events: auto`, so it eats look-drags. On the phone, Pine at 1.27 GB is well past the 1.0 GB Explorer limit.
   Where: SHARD SELECT ▸ Pine Hollow.
   Files: `18-pine-memory-warning-covers-screen.jpg`, `clip-11-pine-solo-memory-warning.mp4`.
   Rows: SF18b (G216 warning look, `src/game/grid/memoryWarning.css`), SF47 / SF22d (Pine memory).
4. **Giant grey "walls" in the far view.** They are over 100 m tall, have a stretched streaky texture and snowy tops, and
   look like a broken skybox. Two stand at the north corners of the Sky Reach cell, right beside the SE and SW
   roundabouts, and one is in the distance north of Pine. They vanish as you get close (pop).
   Where: boulevard at (±250, −280); the x = −279 road looking north.
   Files: `clip-03-boulevard-tall-walls.mp4`, `08-seam-cliff-east-boulevard.jpg`, `08b-seam-tower-se-corner.jpg`,
   `07-sky-reach-corner-wall-sw.jpg`, `16-far-wall-north-of-pine-vanishes-close.jpg`.
   Rows: SF23 (far view) / SF17b (seams), with SF49's far proxy as the likely source near Sky Reach.
5. **The templates are still mostly empty.** G220's Template 1 fill is in: a gate at each entry, a lamp-lit grid road
   to the centre, a small hub with a 5 × 3 block and stairs, and a creature. The rest of the 500 m cell is still a flat
   white plane, the hub is small, and the corners hold nothing. All four template cells look identical.
   Where: Template-1, -2, -4 and -6.
   Files: `clip-06-template2-entry-to-hub.mp4`, `clip-12-template4-entry-barren.mp4`, `11-template2-hub-centre.jpg`,
   `15-template4-centre-from-east.jpg`.
   Row: SF52 (G220).
6. **Stuck: the hoverboard can't climb back onto Driftwood's north pier from the beach.** Leaving Driftwood north, the
   board stops at z ≈ 189 where the pier meets the sand, twice. The west pier climbs fine.
   Where: Driftwood N entry, outbound.
   File: `clip-09-driftwood-north-pier-stuck.mp4`.
   Rows: SF46 (Driftwood entries, G93) / SF18d.
7. **At full speed the hoverboard tunnels into the template hub block, and the camera ends up inside it.** The screen
   becomes solid orange grid. At low speed the block collides normally, stopping you at about 15 m from the centre.
   Where: Template-2 centre, arriving from the N entry at ~24 m/s.
   File: `12-camera-inside-hub-block.jpg`.
   Rows: SF18d (traversal safety) / SF52.
8. **Grid memory is already at 91–94 %, and the PTS bar is cryptic.** The red PTS bar across the upper third reads
   "XROADS 91 · 907.8/1000.0 MB DRIFTWOOD ISLE 318 · 8 OK PLATFORM 83.0" and climbs to 938 MB, with only Driftwood and
   template neighbours loaded. That leaves no room to admit any real neighbour, even once shardfiles exist. A player
   can't read the bar.
   Where: every grid frame.
   Files: `05-grid-arrival-pier.jpg`, plus any grid still.
   Rows: SF18b (residency) / SF22d (memory cuts) / SF38 (the overlay's words).
9. **The look snaps at every crossing, and the road looks washed out.** On the road the sky is a pale grey-blue haze.
   Crossing into a shard switches the whole frame to that shard's bright sky in a single frame, with no blend.
   Where: every entry.
   Files: `clip-05-crossing-into-template2.mp4`, `clip-08-driftwood-north-entry.mp4`.
   Rows: SF19a / SF19b.
10. **Small UI faults, in one batch:**
    - Settings prints "Apply **&amp;** reload drops it" (`src/engine/strings.ts:305`; `:318` has the same escape)
      (`02-settings-amp-escape.jpg`).
    - In SHARD SELECT, the EXPLORE WORLD button overlaps the title (`17-shard-select-carousel.jpg`).
    - The minimap is a grey blur inside templates (`11-…`), and on Driftwood's pier it labels the cell south of you
      "SKY REACH" (`05-…`).
    - Every template cell's title card reads "TEMPLATE SHARD · GREY-BOX TEACHING LEVEL", with no instance identity.
    - In Sky Reach alone, the quest-marker "8 M" chip sits over the HOVER button (`21-ss-sky-reach-marker-over-hover.jpg`).
    - In Nine Dragon alone, walking 125 m straight from spawn ends in a flat grey void between buildings
      (`20-ss-nine-dragon-grey-void-30s.jpg`).

    Rows: SF21a / SF28 / the minimap blend (G107) / SF50-ish for Nine Dragon.

Also seen, not ranked:
- A lamp post sweeps through the camera at the SE roundabout (seen on the Template-6 leg; no clip kept).
- One exit from Template-2 left through its north edge about 35 m east of the entry; check whether loaded template cells
  can be left off-entry.
- The loading card still says "PROJECT WILDSHARD · A world that does not exist yet, arriving one chunk at a time."

## (c) What worked well

- **Menu:** both doors show with Developer on, and one wide SHARD SELECT card with it off (G88/G212). What's New lists
  the day's four changes.
- **Reveal:** the sky-down reveal to Driftwood's pier is quick (about 8 s to load, then the flyover), and tap-to-skip is
  shown.
- **Crossings:** every crossing into Driftwood or a template worked. The title card shows, SAFE ZONE turns on and off,
  the weapon stows on the road and comes back out inside, and the frame-of-reference rebase is invisible.
- **Driving:** the boulevard, the roundabouts, the 15 m entry asphalt and the signs are clean and readable. Hover driving
  produced no falls and no stalls.
- **The cell screen from the road (G217):** from 25–50 m it is clear and honest about why a cell is refused.
- **SHARD SELECT:** all seven shards load alone in a few seconds and walk cleanly for 30 s.
