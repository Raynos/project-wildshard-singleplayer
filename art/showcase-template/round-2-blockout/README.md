# showcase-template / round-2-blockout: every pack, elite and pickup placed, and does it still fit?

Round 2 of the Kitchen Sink v2 grey blockout (round 1: `../round-1-blockout/`, 8094bf351f). It does the "Round 2" list
of `docs/plans/kitchen-sink-v2/map-layout-mini-plan.md`, then Jake's 11-02 ask: *"We're packing a lot of content and a
lot of enemies into this. Beef up the blockout and double-check it all fits, and figure out how to make it fit."* So it
is also a full content placement pass: every pack, elite lair, chest, crate, Gold 1×1, quest target and beacon has a
spot, and the fit is measured, not eyeballed.

**Verdict: it fits, after three fixes.** At round 1's open-ground pack spacing, bands 2 and 6 held only 5 and 9 of the
9–10 pack slots they need (band 3 went short too once band 2 was packed). The fixes are below. With them, every band
holds its 9 packs (3 per level) and its elite, no band makes you wait on respawns, and 24.9 % of the cell is still free.

| File | What it shows |
|---|---|
| `01-plan.jpg` | Top-down plan: zones with sizes, quest targets !, beacons ✦, vistas ★, caches ◆, Gold 1×1s ●, the vault's rooms dashed; hub inset with every NPC; elites; why the beacons sit where they do |
| `02-placement.jpg`, `02b-placement-south.jpg` | The content placement, east half in two squares: every pack with its aware ring and Mk tier, night-shift packs in blue, elites ◆, chests ■, loot crates ▪, Gold 1×1s ●, quest targets with their level lock, beacons, cover; the fit table |
| `03-budget.jpg` | Used vs free at 1 m, round 1 in brackets |
| `04-aerial.jpg` | The whole cell from 470 m |
| `05`–`14` | Eye height (1.7 m), iPhone portrait: hub, west hop chain from the lookout, one per band (packs are named; night shift is dark blue with lit eyes), the Training Vault entrance, the Crate Titan approach |
| `15-round-1-vs-round-2.jpg` | Round 1's plan above round 2's, same scale (stacked, since side by side is unreadable in portrait) |

To rebuild: `scripts/browser-lane.sh node art/showcase-template/round-2-blockout/capture.mjs [view,…]` (serves the
repo root on loopback, muted "iPhone 16 Pro", 402 × 874). `node art/showcase-template/round-2-blockout/placement.js`
prints the fit tables without a browser. `layout.js` holds every number, `placement.js` places the content and does
the maths, `lab.js` draws it.

## What changed from round 1, and why

1. **The west portal vault is gone.** The Training Vault is the mini dungeon: a portal gatehouse at band 4's south end
   (22 × 22 m) and four rooms (puzzle 24², fight 30², climb 20² × 20 m tall, the Vault Warden's r 16 room) 40 m under
   the cell, 0 m² of surface. The freed west ground stays free: its **lookout bench** is the one spot where the tank,
   the mast and the tower read in one portrait frame (`06`).
2. **No fixed chain.** Quests are freeform and level-locked. Three givers in the hub, one per tier (Yard Boss L1–6,
   Surveyor L7–12, Shift Boss L13–20), stand beside the quest board; a target sits at each band's three Mk tiers
   (18) plus six specials (Big Pallet, the Training Vault, the keycard, storm hour, Foreman Unit 7, the Crate Titan).
3. **Hub r 40 → r 28.** Board, contracts, vendor, upgrades, feats and trophy wall sit on an r 11–15 ring, at most
   29 m apart (7 s walking). Tinker Rook stands between his vendor stall and the upgrade counter.
4. **Cover in every band**, themed to its enemy: crate stacks (Mites), walls (Pallet Jacks stun themselves on them),
   scaffold frames with 6 m screens (drones), three-walled welding bays with slag (Welders), tall walls (the stealth
   yard), half-height L-covers (Arc Sentries). 413 pieces. Floor-to-nearest-cover: p50 6 m, p95 10 m, max 18 m; round
   1's three-crates-per-pack rule gave p95 46 m, max 83 m.
5. **Enemy names and shapes** from the round-3 levels page; night-shift spawns are marked (dark blue, lit eyes).
6. **West silhouettes:** the cistern block became an 18 m white round tank, the mast a single 28 m pole with a cyan
   ball, the tower an open 45 m lattice with a cyan crown, and the movers park stands on stilts so it reads as one
   rising staircase. Each is its own shape, colour and height.
7. **Storm beacons on band 5's four corners**, outside the stealth-yard walls, 108–124 m apart and each in sight of
   the next. Storm hour is the L13 quest and the storm is the yard's cover, so the beacons sit in the band the quest
   is for. At the cell corners (round 1) two would be in the west, with no enemies and no stakes; at the east half's
   corners (the mockups) two are in band 3 (grey to an L13 player) and one beside the Crate Titan (L20).
8. **The Crate Titan stays in the far south-east** (the levels page's "north-east" is ignored).
9. **Elites, per Jake's 11-02 census rule:** six. Three band-gate elites: Big Pallet L6 (its pit in band 2), the Vault
   Warden L12 (room 4 of the Training Vault), Foreman Unit 7 L18 (the gauntlet's wave finale, so round 1's separate
   L18 pit is gone). Three night elites spread low, mid and high, each with an r 8 lair: Sir Nibbles L5 (band 1),
   Nailbiter L11 (band 3), Riveting Rita L17 (band 5, in the yard).

## Budget (250,000 m², 1 m raster)

| Category | m² | % | Round 1 |
|---|---|---|---|
| West non-combat zones | 46,952 | 18.8 | 20.2 |
| West support (mount post, cave hill) | 5,500 | 2.2 | 3.2 |
| East level bands | 78,513 | 31.4 | 29.8 |
| East set pieces (yard, gauntlet, Big Pallet pit, vault gatehouse, Titan + approach) | 20,720 | 8.3 | 9.3 |
| Roads, strip, ring, wall | 35,992 | 14.4 | 14.7 |
| **Free** | **62,323** | **24.9** | 22.7 |

West 42 % used, east 79 %. The hub shrink and the vault's move freed 7,700 m² in the west.

## Zones

| Zone | Footprint | m² | Notes |
|---|---|---|---|
| 01 Hub | ⌀56 (r 28) + 10 m ring road | 2,463 | services ≤ 29 m apart; 3 givers + Tinker Rook |
| 02 Weapon range | 75 × 100 | 7,500 | practice only |
| 11 Physics + hover | 140 × 90 | 12,600 | halfpipe, kickers, see-saw, plates |
| 05 Movers park | 78 × 80 | 6,240 | a staircase on stilts, 0 → 18 m |
| Water tank | ⌀34, 18 m | 908 | roof vista, hook 1 |
| 06 Grapple tower | 24 × 24, 45 m | 576 | lattice; zip 146 m to the mount post |
| 04 Riding oval | 208 × 88 | 16,642 | the stable hand and loaner horse at the mount post (600) |
| Cave hill | 70 × 70 | 4,900 | squeeze cave under it |
| Band 1 · Crate Mite L1–3 | 80 × 120 | 9,600 | Sir Nibbles' lair |
| Band 2 · Pallet Jack L4–6 | 112 × 100 | 11,200 | Big Pallet's pit (r 14) |
| Band 3 · Plumb Drone L7–9 | 229 × 77 | 17,633 | Nailbiter's lair |
| Band 4 · Welder Unit L10–12 | 117 × 152 | 17,784 | Training Vault gatehouse 22 × 22 (484) |
| Band 5 · Riveter L13–15 | 117 × 142 | 16,614 | the stealth yard 100 × 104 (10,400) is the band; Riveting Rita; 4 beacons |
| Band 6 · Arc Sentry L16–18 | 104 × 177 + 40 × 87 | 21,888 | gauntlet ⌀72 (4,072), Foreman Unit 7 |
| Crate Titan L20 | ⌀76 + approach 39 × 16 | 5,160 | far south-east |

## Content census

| Item | Count | Where |
|---|---|---|
| Common packs | 54 (9 a band: 3 per Mk tier, one tier per level) | lattice-placed in each band, rising away from its entry |
| Common enemies by day | 117 | Mites in threes (27), every other type in pairs (18 a band) |
| Night-shift points | 12 (2 a band) | the two top-tier packs swap to lamp-eyed L+1 (×1.25 XP) after dark, same spots |
| Rare variants | a roll, no points | proposed 10 % uncommon, 2 % rare, on any common spawn |
| Elites | 6 + the Crate Titan | Big Pallet L6 pit (b2), Vault Warden L12 (vault room 4), Foreman Unit 7 L18 (gauntlet), Sir Nibbles L5 (b1 lair), Nailbiter L11 (b3 lair), Riveting Rita L17 (b5 lair) |
| Loot chests | 12 + the Vault chest | 2 a band, beside cover in the Mk II and Mk III areas |
| Loot crates (breakable) | 36 | 6 a band, beside cover |
| Gold 1×1 cubes | 20 | 10 west (tank roof, tower deck 4, hill top, squeeze cave, halfpipe lip, oval infield, berm top, movers top step, mount post roof, hover park), 10 east (one per band, vault roof, Titan rim, keycard shed roof, gauntlet rim, beacon 3 crown) |
| Vistas · caches | 8 · 4 | tank, tower, hill, Titan rim, three cell corners, the lookout · four edge caches |
| Quest targets | 24 | 18 by band tier (lock = that tier's level) + Big Pallet, Training Vault, keycard, storm hour, Foreman Unit 7, Crate Titan |
| Contract board | 13 | 6 count contracts (one per type), 6 elite contracts, the Titan (LW4's 16 counted 3 separate elites Jake has folded in) |
| Storm beacons | 4 | band 5's corners |
| Hub NPCs | 4 + the stable hand | Yard Boss L1–6, Surveyor L7–12, Shift Boss L13–20, Tinker Rook (shop); stable hand at the mount post |
| Trophy wall | 12 frames | hub; Jake's six elites + the Titan + 2 caches = 9, 3 spare |
| Cover pieces | 413 (39 are sight walls) | b1 37, b2 45, b3 70, b4 74, b5 114, b6 73 |

## The fit check

**Pack spacing.** Two packs must never share a fight: centre spacing ≥ aware + leash + 3 m. The template brain is aware
12 m, leash 25 m (`src/shards/_template/data/creatures.json`), so 40 m; Mites get a proposed smaller brain (aware 8,
leash 18: 29 m) because band 1 is where players learn to pull one pack; drones kite at 12 m, so leash 30 (45 m).
Between two packs at 40 m there are 16 m of no-aggro floor: 3.7 s walking, 2.2 s sprinting (4.3 / 7.2 m/s).

**The three fixes** (all drawn in the layout):

1. **Sight walls.** Nothing aggroes through a 3 m wall, so with a wall between them two packs need only leash + 3 m.
   Bands 2 and 4 (walls, bays) and band 3 (6 m scaffold screens; drones fly at 3 m) use 28–33 m spacing, and a 12 m
   wall stands across the midline of every pack pair closer than the open spacing (39 walls). Band 5's yard walls do
   the same (28 m). Band 2 went from 5 slots to 11; band 3 from 8 to 16.
2. **A smaller gauntlet against the seam:** two seating tiers (r 36, was r 42) at (52, 112); the 56 m floor is kept.
   Band 6 went from 9 slots to 11.
3. **Band 5 is the stealth yard.** Outside the yard the band is 10–22 m strips, too thin for any pack, so its Riveter
   patrols live inside the yard behind its walls.

| Band | Common | Spacing | Slots / needed | Pool per Mk | Loop back | Minutes |
|---|---|---|---|---|---|---|
| 1 | Crate Mite ×3 | 29 m | 10 / 10 | 9 | 176 s | 11 |
| 2 | Pallet Jack ×2 | 28 m (walls) | 11 / 9 | 6 | 116 s | 17 |
| 3 | Plumb Drone ×2 | 33 m (screens) | 16 / 10 | 6 | 119 s | 23 |
| 4 | Welder Unit ×2 | 28 m (bays) | 21 / 9 | 6 | 116 s | 29 |
| 5 | Riveter ×2 | 28 m (yard) | 12 / 10 | 6 | 116 s | 34 |
| 6 | Arc Sentry ×2 | 40 m | 11 / 9 | 6 | 131 s | 40 |

**Respawn vs kill rate.** Commons respawn about 90 s after you leave a pack's area (Jake 11-02). Loop back = from
leaving a tier's first pack, through its other packs at 2.5 kills a minute and the walk, back to the first: 116–176 s,
so every band's first pack is back before you are and nobody waits. The minimum is 4 enemies a tier (2.5 × 1.5 min);
every tier has 6 or 9. **Band 1 has no slack** (10 of 10 slots): one more pack there needs the reshape below.

**Grind and grey kills.** The levels table's ~422 kills to L20 are 154 minutes of band grinding at 2.5 a minute (plus
elites and night shift: the 2.5–3 h target). One tier is one level, so you clear a tier's pool 1.2 (band 1) to 5.8
(band 6) times per level. A kill pays ×0.5 at three levels below and nothing at six, so the pay drops off before the
pool runs dry and you move out: tiers rise away from each band's entry and the entries chain outward (band 1 → 2 →
3 → 4 → road gate → 5 → 6). **Gap:** there is no L19 day tier. Level 19 runs on the L18 Mk III (×0.85) and the
night-shift L19 Arc Sentries: about 44 kills. Recommended: make band 6's Mk III L18–19.

**Phone budget** (from the layout, not measured on a phone; no enemy cap exists in the repo to check against): 117
commons by day; at most 13 in one portrait view (33° wide, to 100 m), 29 within 60 m of any pack, 85 inside the 150 m
near radius. Proposed: full AI within ~60 m and at most 16 animated in view; the rest idle or frozen until you near.
That is the number to measure on the iPhone first.

**If more content comes:** stack and go vertical first (a 6 m loading deck in band 1 gives Mites a second floor
without new ground), then move fights into interiors (the vault model: 0 m²), then trim to 2 packs a tier (still
≥ 4 enemies a tier with pairs; loop back drops to ~70 s, so add a 20 s wall detour), and reshape bands last (band 1
could take the free 32 × 22 m corners beside the hub ring).

## Findings at eye height

- **Hub:** at r 28 the plaza reads as one place, but a centre obelisk and a ring of stalls hide each other in
  portrait. The obelisk moved off-centre and the givers stand beside the board, so from the south gate you see the
  givers' ! marks, the board, contracts and vendor in one frame (`05`).
- **West:** in portrait you still read one structure at a time from most spots; distinct shapes and one lookout that
  frames the whole hop chain are the fix (`06`).
- **Bands:** with cover every ~12 m a pack is always framed by something at eye height (`07`–`12`); type silhouettes
  (cube on legs, forklift, floating drone, torch cone, riot plate, lance) read apart at 20 m.
