# blender-template / round-3-filled: the filled cell (G276, per G220)

Jake's pick (2026-10-09, after `../round-2-look/`): keep look B and fill the Blender Template's 500 m cell with a set
piece at each of the four entries, a hub in the centre and roads between them, all authored in Blender. Real in-game
captures of the built shard (Chromium as an iPhone 16 Pro portrait, muted, phone tier, Developer on), not mockups. The
map's east is -x.

| File | What it shows |
|---|---|
| `board.jpg` | The four entry set pieces, the hub and the view from the watchtower on one labelled board |
| `1-ridge-cut.jpg` | North entry: the 19.2 m rise and its drive-through cut (kept), the bridge, and the new watchtower crown on the east bank |
| `2-market-stoa.jpg` | West entry (+x): two roofed colonnades either side of the road, stalls under them, walkable roofs joined by two footbridges |
| `3-amphitheatre.jpg` | East entry (-x): from the top of the middle aisle, eight seat tiers, slate half-step aisles, the stage and its three-door backdrop |
| `4-aqueduct.jpg` | South entry: the arcade of round arches carrying an 8.8 m slate deck across the road, the cistern tower at its end |
| `5-hub.jpg` | Centre: the walled plaza with a gate over each road, the stepped obelisk south of the crossroads, the hall and its door |
| `6-watchtower-view.jpg` | From the watchtower top (28.2 m): the north spoke to the hub, the ring road, lamp posts, the aqueduct far off |
| `walkthrough.mp4` | 33 s, 540 px, real held-forward input on the walk autopilot: across the bridge and up the watchtower stair, up the stoa stair onto the roof, up the amphitheatre aisle, along the aqueduct deck, past the obelisk to the hall door. A teleport starts each leg; every leg is labelled |
| `capture.mjs` | The capture tool (stills and the walkthrough recording) |

**What was built** (`scripts/blender/blender-template/world.py` → `world.glb`; no generator, no runtime): the north
watchtower (stair from the east bank, merlons), parapets on the cut rims; the market stoa (32 columns, two roofs, two
footbridges, a 25-tread stair, eight stalls); the amphitheatre (half bowl of eight 0.6 m tiers with three aisles of
0.3 m half steps, stage, backdrop, two pylons); the aqueduct (deck from the balcony ramp to a cistern tower, seven piers
and eight arches, an 18-tread stair to the cistern roof); the hub plaza (low walls, four road gates, four corner pylons,
a three-step dais and a 23 m obelisk); a 12 m ring road at 114 m linking the four spokes, waystones where it crosses
them, cairns at its corners, and lamp posts along the spokes. The existing rise, bridge, hall, door, guardian, two-step
quest and reward are untouched. Three clay tones on the two existing materials; walkable tops and aisles are slate; the
door is still the only texture. sp-x6's far-deck seam fix (no two upward faces at one height) is folded in and
extended to every new deck (`test/blender-deck-surfaces.test.ts`).

**Proof:** 12 walk legs, 0 stuck (`progress/shard-platform/g276/walk.json`; the six SF55 legs plus the watchtower, stoa
roof, amphitheatre aisle, aqueduct and cistern, obelisk dais and a full ring-road loop on the hoverboard). Report card
PASS: two world draws, far 0.78 MB, near-player estimate 600.97 MB playing (the card's library is included), worst grid
753.77 / 1000 MB. Map rebaked; places: the hall and bridge as before, plus plaza, watchtower, stoa, amphitheatre, aqueduct and cistern (the last four replace the old canopy, steps and arch).

**Not done:** the door-open beat is not in the video (the capture's KeyE did not reach the touch-tier interaction); the
quest itself is covered by the native proofs.
