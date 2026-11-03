# showcase-template / round-3-blockout: the hub becomes a town, the east splits into quadrants

Round 3 of the Kitchen Sink v2 grey blockout (round 2: `../round-2-blockout/`, c6063ad0ce). It does Jake's 11-03
ruling: *"Having the hub in the centre is going to be such a fail. The centre is so tiny. The hub should take up a lot
of space and work as a village or a mini town. Rebalance a lot of the other content on the west side to make more space
for the hub. I like the top-right quadrant being level 1–3, 4–6, 7–9, 10–12. Then the bottom-right quadrant is level
13–15 and 16–18 and the level-20 boss. The gauntlet and the Crate Titan should be really at the bottom right, the bottom
of the bottom. No level 1–3 enemies in the bottom-right quadrant. Level 13–15 and 16–18 should be their own sections, in
the top half of the bottom-right quadrant; the bottom half of the bottom-right quadrant is just the gauntlet arena and
the Crate Titan. The gauntlet arena can be level 16–18. The stealth yard can double as level 13–15."*

**Verdict: it fits, with room to spare.** The town takes 12.4 % of the cell; the west is 61 % used, the east 71 %, and
19.0 % of the cell is still free. Every band holds its packs and its elite, no tier makes you wait on a respawn, and
the two high bands (where the golden-ratio curve puts ~56 of the ~59 hours) now carry four packs a tier.

| File | What it shows |
|---|---|
| `01-plan.jpg` | Top-down plan: zones with sizes, town gates ⛩, quest targets !, beacons ✦, vistas ★, caches ◆, Gold 1×1s ●, the vault rooms dashed; the town inset with every building, the services and the gates |
| `02-placement.jpg`, `02b-placement-south.jpg` | Content placement, NE and SE: every pack with its aware ring and Mk tier, night shift in blue, elites ◆, chests ■, crates ▪, Gold ●, quest targets with locks, beacons, cover; the fit and grind table |
| `03-budget.jpg` | Used vs free at 1 m, round 2 in brackets |
| `04-aerial.jpg` | The whole cell from 470 m |
| `05`–`07` | The town at eye height (1.7 m), iPhone portrait: the gate plaza's quest corner, Park Lane, Main Street (the shop row) |
| `08` | The west toys from the Rock's lookout: tower, mast, tank, movers spiral, the town roofs |
| `09`, `10` | NE band transitions: band 1 → 2 through its arch (Sir Nibbles' lair), band 3 → 4 with the Training Vault |
| `11` | SE: band 6 looking into the stealth yard (band 5) |
| `12`, `13` | SE bottom: the gauntlet through its gate; the Crate Titan approach |
| `14-round-2-vs-round-3.jpg` | Round 2's plan above round 3's, same scale |

To rebuild: `scripts/browser-lane.sh node art/showcase-template/round-3-blockout/capture.mjs [view,…]` (muted
"iPhone 16 Pro", 402 × 874). `node art/showcase-template/round-3-blockout/placement.js` prints the fit tables without
a browser. `layout.js` holds every number, `placement.js` places the content and does the maths, `lab.js` draws it.

## The three biggest changes

1. **The hub is a walled town, 176 × 176 m (30,976 m², 12.6× round 2's r 28 plaza).** It sits against the seam,
   centred on the west entry's line (x −184 to −8, z −88 to 88). *Why that size:* at eye height in portrait a place
   reads as a town when you can't see out of it. That needs a central square (48 m) with at least two blocks of
   2–4-storey buildings on every side (~60 m each), so the wall is out of sight from most streets (`06`). 176 m is
   about the smallest square that does it. Walking across it takes 41 s (24 s sprinting). Everything a player uses
   stays within 57 m of each other (13 s), because it all sits on the plaza or the first shop-row block.
   - **Layout:** a 48 × 48 m **gate plaza** right inside the east gate holds the quest board and three tier givers
     (Yard Boss L1–6, Surveyor L7–12, Shift Boss L13–20), the contracts board, the 12-frame trophy wall, feats, four
     market stalls and the **obelisk** (now 22 m, the landmark).
   - **Main Street** runs west from the plaza as the **shop row**: Tinker Rook (vendor, UPGRADES, BENCH), a dedicated
     **weapons shop** (needs a keeper NPC: proposed), three empty TO LET fronts for later shops, and the **zip house**
     whose roof catches the grapple tower's 98 m zipline.
   - Lanes run to **six gates**: the Stable Gate (stable, stable hand, paddock, riding course), the Tank Gate, the
     West Gate, the Park Gate, the Range Gate and the **East Gate**. Only the East Gate crosses the seam into combat,
     through the seam gate onto the walled road.
   - 84 buildings, 75 of them houses on generated lots with pitched or flat roofs, and back alleys every ~40 m.
2. **The east is two quadrants with a clear order.**
   - **NE** is bands 1–4 in a 2 × 2 grid that snakes through arches: b1 (from its road gate) → b2 → b3 → b4. Tiers rise
     toward the next arch. Big Pallet's pit sits at b2's exit, the Training Vault gatehouse at b4's east edge.
   - **SE top half:** band 5 *is* the stealth yard (106 × 104 m, beacon towers on its four corners) and band 6 is its
     own section to the west.
   - **SE bottom half** is walled off and holds only the gauntlet (L16–18, back to r 42, Foreman Unit 7 its finale)
     and the Crate Titan at the very bottom right, with its approach off the forecourt.
   - No L1–3 anywhere in the SE.
3. **High bands get four packs a tier.** On the 1.618 curve, band 5 is ~8 h and band 6 plus L19 → 20 is ~48 h. Bands 5
   and 6 now hold 12 packs each, so each tier feeds 6.1–6.6 kills a minute with no waiting (3 packs: ~3.6).
   - Band 6 got 3 m arc screens (sight walls) so 12 packs fit its own section at 28 m spacing.
   - Band 6 also got its own road gate near the town (x 24–44): the grinders' short way home.

## Rebalancing the west

| Toy | Round 2 | Round 3 | What changed |
|---|---|---|---|
| Weapon range | 75 × 100, south-centre | 75 × 100 along the town's south wall | the Range Gate opens onto the firing line |
| Physics + hover | 140 × 90 | 140 × 90, south-west | unchanged size, moved under the Rock |
| Movers park | 78 × 80 (6,240 m²) | 48 × 44 (2,112 m²) | **stacked**: a 1.3-turn spiral of 12 platforms, 1.5 → 18 m, round a core; rope bridge onto the tank |
| Water tank · hook mast · grapple tower | tank, mast, tower west of the hub | tank by the movers, mast and tower west of the town | each hop ≤ 38 m (tank roof → mast 28 m → tower 35 m); zip 98 m onto the zip-house roof |
| Riding oval | 208 × 88 | 208 × 88, north-west | entered from the paddock outside the Stable Gate; stable hand and loaner horse there |
| Cave Hill | 70 × 70 mound (4,900 m²) | **the Rock**, 46 × 60 (2,760 m²) | reshaped and merged into the town's west edge: 16 m crag, scramble climb from the park, ladder from the wall walk, squeeze cave from a town cellar to the park, its top bench is the **lookout** (tank, mast, tower and movers in one frame, `08`) |

All 20 Gold 1×1s and all 12 vistas and caches are kept. Gold on the hill, the hub and the mount post moved to the Rock
top, the obelisk crown and the zip-house roof. The lookout moved to the Rock, and the east gatehouse roof is the new
eighth vista (bands 1–4 in one frame).

## Budget (250,000 m², 1 m raster)

| Category | m² | % | Round 2 |
|---|---|---|---|
| Town | 30,976 | 12.4 | 1.0 (hub) |
| West toys | 40,352 | 16.1 | 17.8 |
| West support (paddock, the Rock) | 4,680 | 1.9 | 2.2 |
| East level bands | 66,423 | 26.6 | 31.4 |
| East set pieces (yard, gauntlet, pit, vault, Titan + approach) | 22,828 | 9.1 | 8.3 |
| Roads, strip, wall | 37,208 | 14.9 | 14.4 |
| **Free** | **47,533** | **19.0** | 24.9 |

The bands look smaller only because the stealth yard (11,024 m²) now *is* band 5 and is counted as a set piece.

## Content census

| Item | Count | Change from round 2 |
|---|---|---|
| Common packs | 60 (b1–b4: 9, 3 a tier; b5, b6: 12, 4 a tier) | +6 (b5, b6) |
| Common enemies by day | 129 (Mites in threes, the rest in pairs) | +12 |
| Night-shift points | 12 (the two top-tier packs a band) | same |
| Elites | 6 + the Crate Titan: Big Pallet L6 (b2 pit), Vault Warden L12 (vault), Foreman Unit 7 L18 (gauntlet); night: Sir Nibbles L4 (b1), Hot Mess L13 (b4), Riveting Rita L16 (b5) | night elites take Jake's §19k names and bands |
| Loot chests · crates | 12 + the vault chest · 36 | same |
| Gold 1×1 · vistas · caches | 20 (10 west, 10 east) · 8 · 4 | same counts |
| Quest targets | 24 (18 tier targets + Big Pallet, Training Vault, keycard, storm hour, Foreman Unit 7, Crate Titan) | same |
| Contract board | 13 | same |
| Storm beacons | 4, on the stealth yard's corner towers (104–106 m apart) | moved with band 5 |
| Town NPCs | 3 givers + Tinker Rook + weapons keeper (proposed) + the stable hand | +1 |
| Cover pieces | 342 (68 sight walls) | b6 gained arc screens; cover stays 14 m off the arches |

## The fit check

Pack spacing as round 2: aware + leash + 3 m in the open (Mites 29 m), leash + 3 m behind a 3 m wall (28 m; drones
33 m). The no-wait ceiling is new. At *r* kills a minute, leaving a tier's first pack and getting back to it takes
(n − 1) × pack size / *r* + the loop walk. That must be ≥ the 90 s respawn. Solve for *r*, worst tier.

| Band | Common | Spacing | Slots / needed | Packs | Pool a tier | Loop back at 2.5/min | No-wait ceiling | Hours (1.618 curve) |
|---|---|---|---|---|---|---|---|---|
| 1 L1–3 | Crate Mite ×3 | 29 m | 11 / 10 | 9 | 9 | 164 s | 5.2/min | 0.2 |
| 2 L4–6 | Pallet Jack ×2 | 28 m (walls) | 16 / 9 | 9 | 6 | 120 s | 3.7/min | 0.3 |
| 3 L7–9 | Plumb Drone ×2 | 33 m (screens) | 13 / 9 | 9 | 6 | 119 s | 3.6/min | 0.8 |
| 4 L10–12 | Welder Unit ×2 | 28 m (bays) | 12 / 10 | 9 | 6 | 120 s | 3.7/min | 2.4 |
| 5 L13–15 | Riveter ×2 | 28 m (yard) | 13 / 13 | 12 | 8 | 180 s | 6.6/min | 7.9 |
| 6 L16–18 (+19 → 20) | Arc Sentry ×2 | 28 m (arc screens) | 18 / 12 | 12 | 8 | 175 s | 6.1/min | 47.8 |

- **Grind on the golden curve.** XP to the next level is 100 × 1.618^(L−1). An equal-level kill pays 10 × L. Kills per
  level run 10, 8, 9, 11, 14, 18, 26, 36, 52, 76, 112, 166, 248, 372, 562, 852, 1,298, 1,983, 3,040: ~59 h at 2.5 a
  minute.
- **Bands 5 and 6 hold ~56 of those hours.** With 3 packs a tier they would feed only ~3.6 kills a minute before a
  player waits. A geared player (Forge IV) kills faster than the 2.5 baseline, so at 4/min they would stand idle.
  With 4 packs a tier both bands clear 6 a minute.
- **Variety over a long grind.** Band 6 is still 380 laps of one tier per level at L18–19. That is the curve, not the
  layout. The gauntlet's L16–18 waves, night shift (L19) and Rita's lair give band 6 grinders something else to loop.
- **Band 5 is exactly full** (13 / 13: 12 packs + Rita's lair in the yard). One more pack there means a bigger yard
  or a second yard floor. Band 1 has 1 slot spare.
- **Phone load** (estimated from the layout, not measured): 129 commons by day; at most 15 in one portrait view (33°,
  100 m), 29 within 60 m of any pack, 100 inside the 150 m near radius. The Wave 1 enemy cap (full AI within 60 m, at
  most 16 animated on screen) still covers it, but only just in view (15 of 16). The densest spot is band 5–6's shared
  edge.
- **Cover:** floor to nearest cover p50 6 m, p95 10 m, max 20 m.

## Findings at eye height

- **Town:** the streets read as a town at 1.7 m: houses on both sides, roofs above, the wall out of sight (`06`). The
  plaza is big enough to need furniture: without the market stalls and lamp posts it read as a car park. Shop signs go
  on the street face over the awnings; signs on the plaza face are lost in portrait.
- **West:** the Rock's lookout gives the one frame where the whole hop chain, the movers spiral and the town roofs read
  together (`08`).
- **NE arches** name each band and its levels as you cross (`09`, `10`). Cover is kept 14 m off them so the view through
  stays open.
- **SE:** band 6 and the yard read as two places, with the yard's beacon towers as the skyline marker (`11`). The bottom
  half is open ground with two arenas. It reads as "the end" from the gauntlet gate (`12`).

## Open for Jake

- The weapons shop needs a keeper: a 6th town NPC (the plan's §19e lists 4–5).
- Band 6's road gate near the town is the grinders' short way home. Without it, band 6 is reached only through the
  yard (~60 s walk from the East Gate instead of ~10 s).
