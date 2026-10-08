# Agent playtest round 1: fixes for the sky blend, the pier climb and the hub collision (playtest1 lane)

The rows are from `art/playtest/round-1-2026-10-07/README.md` (#9, #6 and #7). Captures use Chromium emulating an iPhone 16
Pro in portrait, muted, one browser through `scripts/browser-lane.sh`. HEAD (`e1f4ae324` … `86bb8a5ce`) did not boot the
grid during this run: a load error ("Cannot read properties of undefined") showed on the menu, which is the Driftwood-in-grid
crash another lane is bisecting. So the diagnosis ran on `edd505802` (the playtest build), and the pier fix was proven on
`a59fb7e92` = `edd505802` + the fix (a detached probe commit served with `scripts/serve-build.sh --rev`).

## #9: the sky "snaps in one frame" at a crossing

**Result: the band blends. There was no one-frame snap to fix.** `sky.mjs` drives the hoverboard at full speed across the
cell edge and back. It reads `shard.grid.state().frame` every frame and records the video. `sky-crossings.json` and the
strips (one frame every 0.1 s, each labelled with the time, the distance from the edge and the road weight) show the road
weight going 1.00 → 0.97 → 0.93 → 0.79 → 0.67 → 0.49 → 0.36 → 0.24 → 0.11 → 0.04 → 0 across about 1.2 s. The road sky
dome, the air and the grade follow the weight, and the pixels blend with it:

- `sky-template-in.jpg`, `sky-template-out.jpg`: road ↔ Template-2 (the west edge, x = 305)
- `sky-driftwood-in.jpg`, `sky-driftwood-out.jpg`: road ↔ Driftwood (the north edge, z = 250)

A crossing never happens at 30 m/s: the grid's hover rules (`installGridHoverSpeed`) slow the board to the shard cap
(14 m/s) on the entry asphalt before the edge, so the 16 m band takes about 1.1 s. Leaving a shard, the board speeds up
from 14 m/s across the band. In clip-05 the board turns sharply in the same frame the playtest driver crossed over (the
frame re-origin at about 5 m out, road weight 0.04). That jump made a 0.6 s blend read as a cut. In clip-08 (Driftwood
north) the blend can be seen over about 0.5 s.

## #6: the hoverboard can't climb from the beach onto Driftwood's north pier

**Cause:** the north jetty (`JETTIES[0]`, length 60) ended at z = 190 with its deck at y 1.20, over sand at y −0.24: a
1.45 m step. You can walk off it, but neither walking nor the board can climb back up. `pier-before-standalone.json`
shows both stuck at z = 189.4. **Fix:** the north jetty gets the south pier's `landing`: the deck runs on to the dry sand
and ramps down onto it (about 0.4 m over 5.5 m, the same model). The west jetty already meets its sand flush (y 1.09 vs
1.20). The east jetty also ends about 1.9 m over a wet hollow (y −0.7). The playtest didn't try the east exit, and a
landing there would march toward the wreck, so it is left as found.

| proof | stuck |
|---|---|
| `pier-after-standalone.json`: walk and hover beach → jetty → socket, an off-centre hover line, jetty → beach both ways | 0 |
| `pier-after-grid.json`: the same five legs in INFINITE WILDSHARD | 0 |
| `playtest1-jetty-a59fb7e-muysuto8.json`: `physics-baseline --mode=walk --shard=driftwood-isle` (8 legs) | 0 |
| `playtest1-jetty-entries-a59fb7e-muysuto8.json`: the SF46 entries route (N/E/S/W in and out, pier to boat) | 0 |

The Driftwood navmesh is rebaked for the new deck (`bake-check --node-only` is clean).

## #7: "the hoverboard tunnels into the template hub block, and the camera goes inside"

**Result: no tunnelling at 30 m/s.** `hub.mjs` poses the board on Template-2's roads and drives straight lines into the
hub at a forced 30 m/s: the hut from N, S, E and W, the tower, the office, the arcade and the sheds. `hub-30ms.json`: every
line that meets a building stops at its face (the hut at z −8.5, −15.5 and x −3.5, the tower and office at z −82.6, the
arcade at x −97.9). The rider's capsule is checked against WORLD colliders every frame, inset 6 cm, and overlaps 0 times.
The camera is first-person and stays at the head, which stops 0.35 m from the face with near = 0.08. So it never goes
inside, but a 6 × 3 orange measure wall at 0.35 m fills the whole screen (`hub-south-wall-face.jpg`). That is the playtest's
"solid orange grid" still.

Two template defects the probe found (left for the template / shardfile-sim owner):

1. **An invisible creature collider sits at the cell centre.** It is a 0.99 m ball in the CREATURE group at (0, 0, 0), the
   size of `big-blob` (scale 1.8), whose spawn is (−15, 0, −20) (`hub-30ms.json` `survey`). It stops a north-spoke run dead
   at z +1.4. That is the playtest's "at low speed the block collides normally, stopping you short of the centre".
2. **The hut's door panel has no visual but still collides.** The grid draws the doorway open, but the panel collider
   (0, 1.2, −9) is enabled. If the published door field opens it, the collider drops and the board can drive through the
   2 m doorway into the hollow hut. From inside, the camera sees only the orange walls, which is the most likely source of
   "the camera ends up inside it".
