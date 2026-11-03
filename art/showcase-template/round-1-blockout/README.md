# showcase-template / round-1-blockout: does it fit in 500 × 500 m?

A measured grey blockout of the Showcase Template (KITCHEN-SINK, Template 3) with Jake's content pick and his
east/west ruling of 2026-11-02: **west half non-combat, east half combat only** in level bands 1–18 with mini-bosses at
L6, L12 and L18 and the L20 boss last. Taming, the creature pen, water, happenings, time trials, thin ice and the glide
shaft are out.

It is a standalone three.js page, not a shardfile. The question is about area, sightlines and routing, and a page
answers that in an hour with exact numbers. A cloned shardfile would spend that time on admission and baking before it
showed a single zone.

**Verdict: it fits.** The west uses 47 % of its half, the east 78 % of its half, and 23 % of the whole cell is still
free. Area was never the limit; the image-gen overview (`../../blender-template/round-5-content/13-overview.jpg`) only
looked crowded. The real limits are the cell-wide sky, keeping enemies out of the west and off the east entry, and
what you can read at eye height.

| File | What it shows |
|---|---|
| `01-plan.jpg` | Top-down plan, 50 m grid, every footprint in m, the 9-leg chain, vistas ★, caches ◆, loot chests ■ |
| `02-budget.jpg` | Used vs free by category, the 16 m edge band, the 62.5 m render tiles, every zone's area |
| `03-aerial.jpg` | The whole cell from 470 m up, with the road gap and the neighbours |
| `04`–`08` | iPhone-portrait views at 1.7 m eye height: hub, west traversal cluster, east gate into band 1, the L20 boss approach, the north entry from the road |

To rebuild, run `scripts/browser-lane.sh node art/showcase-template/round-1-blockout/capture.mjs`. It serves the repo
root on loopback and captures as a muted "iPhone 16 Pro" at 402 × 874. `layout.js` holds every number; `lab.js` draws
the layout and rasterises the budget at 1 m.

## Numbers it is sized from (read from the repo)

- **Movement:** walk 4.3 and sprint 7.2 m/s (`engine/player/walk.ts`); hoverboard 14 m/s (`hoverSpeed.ts`); gallop
  13 m/s (Nalati `ecology.json`); gallop turn ≈ 21 m radius (`riding/physics.ts`); grapple 2.5–38 m and zip 22 m/s
  (the grapple mode defaults).
- **Reference spaces:** the Driftwood boss arena is r 22 (`bossEncounter.json`); the Nalati oval is 120 m straights
  with r 38 bends (`horseCourse.ts`).
- **The cell and grid:** 8 m entries with 15 m of asphalt, a 62.5 m road gap, a 16 m look blend at the edge, 62.5 m
  render tiles (8 draws, 40k triangles each) and 250 m of cell below the deck (`contentBounds.ts`, `roadLayout.ts`,
  `grid/frame.ts`).

## Budget (250,000 m², 1 m raster)

| Category | m² | % of the cell |
|---|---|---|
| West non-combat zones | 50,396 | 20.2 |
| West support (mount post, cave hill, vault) | 8,100 | 3.2 |
| East level bands | 74,585 | 29.8 |
| East set pieces (stealth yard, gauntlet, 3 mini-boss pits, boss + approach, dungeon door) | 23,208 | 9.3 |
| Roads, strip, wall | 36,856 | 14.7 |
| **Free** | **56,855** | **22.7** |

## Zones

| Zone | Footprint | m² | Why this size | Stacked / notes |
|---|---|---|---|---|
| 01 Hub (seam) | ⌀80 | 5,027 | givers, contract board, vendor + upgrades, trophy wall, feats | its east gate is the only door to combat |
| 02 Weapon range | 75 × 100 | 7,500 | 5 lanes (sword combo/parry, spear, bow, crossbow ammo, lever rifle); targets 10–50 m, rifle to 75 m | practice only; fires south into a berm |
| 11 Physics + hover | 140 × 90 | 12,600 | 45 m halfpipe; kickers with a 45 m run-up (3 s at 14 m/s); see-saw; crates | pressure plates |
| 05 Movers park + cistern | 78 × 80 + 37 × 40 | 7,720 | lifts, spinners, sliders, conveyors and pads climbing 0 → 18 m | a rope bridge onto the roof; the roof is a vista |
| 06 Grapple tower | 30 × 30 | 900 | 45 m tall; cistern roof → mast → tower, every hop ≤ 38 m | 146 m zip (7 s) down to the mount post |
| 04 Riding oval | 208 × 88 | 16,642 | the shipped Nalati oval: a 479 m lap is 37 s at a gallop | the mount is handed out at the post (600 m²) |
| Cave hill | 70 × 70 | 4,900 | 16 m mound: scramble, ladder, vista | cave + squeeze through it, caches |
| 12 Portal vault | 50 × 52 | 2,600 | gatehouse + walk-in portal | pressure-plate room 60 × 60 m at y −60 |
| Band 1 · L1–3 | 68 × 120 | 8,160 | the east gate, both sides of the road | |
| Band 2 · L4–6 | 112 × 100 | 11,200 | | mini-boss L6 pit (r 14) at its far corner |
| Band 3 · L7–9 | 229 × 77 | 17,633 | the north strip, west → east | |
| Band 4 · L10–12 | 117 × 152 | 17,784 | north → south | mini dungeon portal (40 × 50 m at y −40); mini-boss L12 at the road gate |
| Band 5 · L13–15 | 117 × 142 | 16,614 | | 07 stealth yard 100 × 104, storm hour |
| Band 6 · L16–18 | 104 × 177 + 40 × 87 | 21,888 | | 08 gauntlet ⌀84; mini-boss L18 |
| 09 Boss L20 + approach | ⌀76 + 39 × 16 | 5,160 | Driftwood r 22 + 6 = an r 28 floor; a straight walk-in for the in-engine intro camera | the far corner, ~270 m from the hub |

These cost no floor space: the vistas (tower, cistern, hill, arena rim, corners), hidden caches, loot chests and crates,
collectibles, trophy wall, feats and FINDS discovery, one checkpoint card per leg, ladders and rope bridges, and every
interior under the cell.

## What spills, what moves, what to cut

- **Nothing spills, nothing needs cutting for area.** The interiors (vault, mini dungeon, cave) sit under the cell.
- **The halves need hard edges.** A seam wall runs down the east side of the north–south avenue. The east road is
  walled from the hub to the east entry, so a player arriving from the east neighbour lands on a safe corridor and
  never in band 4 or 5. The road has two gates: band 1, and the L12 crossing.
- **Danger rises along the path, not by straight-line distance.** The east half is only 230 m deep, so after band 3
  the bands sit 150–200 m from the hub. They are still walked in order, as a serpentine that ends at the boss in the
  far corner. Walls and floor tints make the order readable.
- **Weather and day/night are cell-wide.** There is one clock and one weather state per cell (`grid/frame.ts`,
  `grid/regionLight.ts`). Storm hour therefore turns the whole cell for leg 8, which lands on the stealth yard, where
  the storm is cover.
- **Eye-height findings:**
  - At eye height an 80 m hub reads empty (`04`); round 2 should shrink it to r 25–30.
  - In portrait you read one structure at a time (`05`).
  - One enemy pack per ~3,500 m² reads sparse (`06`), so the bands want cover and props between packs, not more
    floor.

## The chain (~1.9 km straight-line, ~2.2 km walked)

West loop, no enemies, back to the hub:

1. Hub: take the contract.
2. Range: practise every weapon.
3. Hoverboard and physics park.
4. Movers park → cistern → grapple → zip.
5. Take the mount at the post and beat par on the oval.

East serpentine, outward:

6. Bands 1–2, then mini-boss L6.
7. Bands 3–4 (dungeon side door), then mini-boss L12.
8. Storm hour: band 5 stealth yard, band 6 gauntlet, then mini-boss L18.
9. The Crate Titan, L20.
