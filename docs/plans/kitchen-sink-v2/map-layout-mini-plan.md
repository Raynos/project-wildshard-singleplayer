# Mini plan: the map, west vs east, in one 500 m cell

Parent: [KITCHEN-SINK.md](../KITCHEN-SINK.md) §3. Jake, 2026-11-02 (E523): *"500 by 500 is the limit … we just need to
figure out how to slam as much of this into a 500 by 500 as we can … block it out in the gray."* Then: *"split this
shard into the left half and the right half … the east half is combat only … the west half is all the other stuff."*

## Round 1 blockout (done, 8094bf351f)

`art/showcase-template/round-1-blockout/`: a standalone three.js grey page (`index.html`, `layout.js`, `lab.js`,
`capture.mjs`, README with the zone table), 8 labelled iPhone-portrait captures. A lab page beat a WIP shardfile:
exact area, routing and sightline numbers in about an hour, with no admission or baking.

**Verdict: it fits with no cuts.** Measured at 1 m over 250,000 m²:

| What | m² | % |
|---|---|---|
| West non-combat zones | 50,396 | 20.2 |
| West support (mount post, cave hill, vault) | 8,100 | 3.2 |
| East level bands | 74,585 | 29.8 |
| East set pieces (stealth, gauntlet, 3 mini-boss pits, boss + approach, dungeon door) | 23,208 | 9.3 |
| Roads, perimeter, wall | 36,856 | 14.7 |
| Free | 56,855 | 22.7 |

Sizes come from game data: walk 4.3, sprint 7.2, gallop 13, hoverboard 14 m/s; gallop turn ~21 m; grapple 2.5–38 m;
zipline 22 m/s; Driftwood's arena r 22; Nalati's oval (120 m straights); 8 m edge entries, 62.5 m road gap.

**Layout rules from round 1**
- The hub sits on the centre line; its east gate is the only way into combat. A seam wall runs north–south and the east
  road is walled, so an arrival from the east neighbour lands on a safe road.
- Bands 1–6 snake outward from the east gate to the L20 boss in the far south-east (~270 m from the hub); the mini-bosses
  sit at the band changes (L6, L12, L18). After band 3 the danger rises along the path, since the east is only 230 m deep.
- Weather and day/night are one state per cell (storm hour turns the whole cell).
- Interiors (shrine, cave) sit under the cell at 0 m².

**Zones (round 1):** hub ⌀80 m · weapon range 75 × 100 · physics + hover 140 × 90 · movers park 78 × 80 + cistern
37 × 40 · grapple tower 30 × 30 (45 m tall, zip 146 m) · riding oval 208 × 88 + mount post 30 × 20 · cave hill
70 × 70 · bands 8,160–21,888 m² each · stealth yard 100 × 104 · gauntlet ⌀84 · boss ⌀76 + approach 39 × 16 · three
mini-boss pits ~616 m² each · dungeon portal 16 × 16.

## Round 2 (done, c6063ad0ce: `art/showcase-template/round-2-blockout/`)

Verdict: everything fits after three fixes (walls between close packs in bands 2–4, a smaller gauntlet against the
seam, Riveters inside the stealth yard); 24.9 % of the cell free. Full census and fit tables in its README and
`node placement.js`. The parent §3 summarises it. The list below was its spec.

Everything Jake ruled after round 1, plus what the eye-height views showed:

1. Merge the west portal vault into the east mini dungeon (the Training Vault portal in band 4, Vault Warden L12); give
   the freed west ground to the cave hill or leave it free.
2. Drop the fixed 9-leg chain; place quest givers in the hub and quest targets by level band (quests are freeform and
   level-locked).
3. Shrink the hub to r 25–30 m; at eye height the 80 m plaza reads empty and the board, vendor and shop sit 20–30 m apart.
4. Cover and props between enemy packs (one pack per ~3,500 m² reads sparse).
5. Name the enemies and mini-bosses from the levels mini plan; mark night-variant spawns.
6. Clear silhouettes for the west traversal cluster (in portrait at eye height you read one structure at a time).
7. Re-measure the budget; captures as round 1 plus a hub close-up and one per band.

## Mockups

- v1: `art/blender-template/round-5-content/` (13 frames, look C).
- v2 layout: `art/showcase-template/round-4-v2-layout/` (~40 frames: map, west, east, systems; in progress).

## Round 3 (done, c292cc13e6: `art/showcase-template/round-3-blockout/`)

Jake 11-03: the hub becomes a town; NE = bands 1–4; SE top = bands 5 (stealth yard) and 6; SE bottom = gauntlet and
Titan only. Result: fits (19.0 % free); a 176 m walled town; the west rebalanced; see the parent §3 and its README.

## Round 4 (done, 4c06e22346: `art/showcase-template/round-4-blockout/`)

Jake 11-03: the town was too big; spend the space on the non-combat content and show it all. Result: a 120 m town, every
west toy laid out and labelled (plus a new physics yard and climb yard), 16.3 % free; the east unchanged. The parent §3
holds the census. Open for round 5 if wanted: taller hover-park ramps so it reads at eye height.

## Rows

| Row | What | Effort |
|---|---|---|
| ML1 | Round 2 blockout (the list above) | done |
| ML3 | Re-label the night-elite lairs to Jake's names (the L19 gap stays, Jake 11-02) | in K1 |
| ML2 | The round 2 layout becomes K1's skeleton data (`layout.js` → shard rows) | in K1 |
