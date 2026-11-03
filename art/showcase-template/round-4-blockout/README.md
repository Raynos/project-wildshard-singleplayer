# showcase-template / round-4-blockout: a smaller town, every west toy on its own ground

Round 4 of the Kitchen Sink v2 grey blockout (round 3: `../round-3-blockout/`, c292cc13e6). **Only the west changed.
The east half is round 3's, untouched**: same zones, same 60 packs, cover, chests, crates, quests and fit tables
(`node placement.js` prints them; they match round 3 to the number).

Jake, 11-03: *"That town might be a little bit too big. We might want to spend a bit more space on all the other
content, all the other non-combat content we're pumping into the mega plan. There's a lot of non-combat content. I
don't know if it's all really shown very well on the map. If the town is big and fits, sure, but it might be a bit
too big."*

**Verdict: it fits, and every non-combat item now has its own labelled footprint.** The town drops from 176 m to
**120 m** (14,400 m², 5.8 % of the cell, was 12.4 %). The 16,576 m² it gives back, plus some free floor, goes to the
toys: west toys and paddock now hold 67,776 m² (27.1 %, was 18.0 %). 16.3 % of the cell is still free (was 19.0 %).

| File | What it shows |
|---|---|
| `01-plan.jpg` | Top-down plan of the cell; each west zone lists what is in it; the town inset |
| `02-west-close-up.jpg` | **The key image.** The west at ~2× scale with every item labelled: town services and NPCs, gates, movers stations 1–6, grapple hooks 1–5 and the zip, climb decks, cave mouths, every PB board, vistas ★1–6, caches ◆1–4, west Gold ●1–10 |
| `03-budget.jpg` | Used vs free at 1 m, round 3 in brackets; west zones in m²; walks from the quest corner |
| `04-aerial-from-the-west.jpg` | The west from the south-west, 540 m up, with the combat half beyond |
| `05`, `06` | Town at eye height (1.7 m): the gate plaza (quest corner, obelisk), Main Street (shop row) |
| `07`–`12` | Eye height: the weapon range, the hover park, the movers sequence, the grapple course + zip, the riding course start (horseback eye), the Rock and its squeeze cave |
| `13-round-3-vs-round-4.jpg` | Round 3's west beside round 4's, same scale, with the m² that moved |

To rebuild: `scripts/browser-lane.sh node art/showcase-template/round-4-blockout/capture.mjs [view,…]` (muted
"iPhone 16 Pro", 402 × 874). `node art/showcase-template/round-4-blockout/placement.js` prints the fit tables, the
budget and the west walks. `layout.js` holds every number (the west toys item by item in `RANGE`, `MOVERS`, `GRAPPLE`,
`CLIMB`, `ROCK`, `HOVER`, `PHYSICS`, `PADDOCK`, `RIDING`, `WALKS`), `lab.js` draws it.

## The town: 120 × 120 m

*Why 120:* the smallest square that keeps what makes it read as a town at eye height: a gate plaza you can't see out of,
one block of 2–4-storey houses on every side of it, and a street long enough to be a shop row. That is a 40 m plaza +
a 72 m Main Street + ~30 m blocks. Below ~110 m Main Street gets too short for four fronts and the zip house, and the
plaza touches the wall. 130 m would only add houses. Everything a player uses stays within 73 m of everything else
(17 s walking).

- **Gate plaza** (40 × 40, inside the East Gate): quest board with **G1 Yard Boss L1–6, G2 Surveyor L7–12, G3 Shift
  Boss L13–20**, contracts board, trophy wall (12 frames), feats, three stalls, lamp posts, the 22 m **obelisk** at the
  head of Main Street (`05`).
- **Main Street** (72 m, West Gate → plaza): **Tinker Rook** (vendor, UPGRADES, BENCH) and the **weapons shop** facing
  each other with their keepers, three **TO LET** fronts, the **zip house** (grapple finish on the roof) (`06`).
- **Stable** and the **stable hand** inside the Stable Gate. All **six NPCs** are inside the walls.
- **Six gates**, each named for what's outside: East (combat, the only way in), Stable (paddock, riding), Movers
  (movers, grapple), West (grapple start, climb yard, the Rock), Park (hover park), Range (range, physics yard).
- 35 houses (75 in round 3), a cross lane and two back alleys.

## West census: item → footprint

| Zone (m²) | Items, each labelled on `02` |
|---|---|
| **02 Weapon range** 78 × 102 (7,956) | melee yard 20 × 48 with **3 sword dummies** and **3 spear dummies** (ring targets) · **2 bow lanes** and **2 crossbow lanes**, targets at 10, 20, 30, 40, 50 m · **crossbow ammo practice** at 20 m: plank (iron), straw bale that burns (pitch), soft dummy (broadhead) · **rifle lane** targets at 25, 50, 75 m · 10 m berm · PB board (range score) |
| **03 Physics yard** 78 × 54 (4,212), new | **3 pressure plates** that open a gate (crates, balls or you) · **3 physics-crate stacks** · **2 see-saws** · **rolling-ball run** (24 m ramp, 4 balls) into 10 skittles |
| **04 Riding course** 208 × 88 (16,642) | Nalati oval, 479 m lap (37 s at gallop) · **8 rings** · **4 jumps** · **start/finish gantry with the lap timer** · PB board (riding lap) |
| **Paddock** 48 × 60 (2,880) | **loaner horse**, mounting block, trough, chute onto the oval (the stable hand is just inside the Stable Gate) |
| **05 Movers sequence** 98 × 58 (5,684) | one straight, numbered run, east → west: start + PB board (movers time) · **1 conveyors** (3 belts, alternating) · **2 jump pads** (3, up to a 6 m ledge) · **3 sliding platforms** (3, over a pit) · **4 spinner** (turning disc + sweep arm) · **5 lift** 6 → 18 m · **6 top deck** → swaying rope bridge onto the tank roof |
| **06 Grapple course** 58 × 118 + 40 × 58 (9,164) | **start pad + PB board** (grapple time) outside the West Gate · **hook 1** pole 12 m · **hook 2** pole 16 m · **hook 3** water tank roof 18 m (ladder) · **hook 4** mast 28 m · **hook 5** the 45 m tower (decks every 9 m, ladder) · **zipline** 99 m on plan (103 m of cable, 4.7 s) over the town wall to the **finish** on the zip-house roof. Hops: 23, 31, 35, 21, 36 m (all ≤ 38) |
| **10 Climb yard** 40 × 56 (2,240), new | **scramble wall** up to deck A · **decks A 6 m, B 10 m, C 14 m**, each with a **ladder** · **swaying rope bridges** A → B → C → the Rock top |
| **The Rock** 44 × 60 (2,640) | 16 m crag, free-standing now · **scramble route** up the south face · **ladder** chimney on the north face · **squeeze cave** 60 m through it (y −6), north mouth on the west avenue, south mouth facing the hover park · **lookout** bench on top (★1) |
| **11 Hover park** 134 × 122 (16,348) | **trick-score start pad + PB board** · **3 kickers** 1.6, 2.4, 3.2 m on 45 m cyan run-ups · **halfpipe** 45 m · **2 quarter pipes** · **funbox** (4 ramps) · **3 grind rails** · **bowl** ⌀24 m |
| Secrets, west | **vistas** ★1 Rock lookout, ★2 tank roof, ★3 tower top, ★4 NW corner, ★5 SW corner, ★6 east gatehouse roof (★7 Titan rim and ★8 NE corner are east, unchanged) · **caches** ◆1 behind the oval, ◆2 behind the Rock, ◆3 hover/physics alley, ◆4 north wall · **Gold 1×1** ●1 tank roof, ●2 tower deck 4, ●3 Rock top, ●4 squeeze cave, ●5 halfpipe lip, ●6 oval infield, ●7 range berm, ●8 movers top deck, ●9 obelisk crown, ●10 zip-house roof |

Personal-best boards: riding lap, movers time, grapple time, trick score, range score (one at each course's start).
Ladders: 6 (climb decks ×3, tank, tower, Rock chimney). Swaying rope bridges: 4.

## Budget (250,000 m², 1 m raster)

| Category | m² | % | Round 3 |
|---|---|---|---|
| Town | 14,400 | 5.8 | 12.4 |
| West toys | 64,896 | 26.0 | 16.1 |
| Paddock | 2,880 | 1.2 | 1.9 (with the Rock) |
| East level bands | 66,423 | 26.6 | 26.6 |
| East set pieces | 22,828 | 9.1 | 9.1 |
| Roads, strip, wall | 37,880 | 15.2 | 14.9 (the west avenue is 56 m longer) |
| **Free** | **40,693** | **16.3** | 19.0 |

## Walks from the quest corner (through the gates; walk 4.3 m/s, sprint 7.2 m/s)

| To | m | Walk | Sprint |
|---|---|---|---|
| Weapon range (firing line) | 81 | 19 s | 11 s |
| Paddock (loaner horse) | 106 | 25 s | 15 s |
| Grapple course (start) | 118 | 27 s | 16 s |
| Climb yard (scramble wall) | 136 | 32 s | 19 s |
| Movers sequence (start) | 150 | 35 s | 21 s |
| The Rock (cave mouth) | 169 | 39 s | 23 s |
| Riding course (start gantry) | 174 | 41 s | 24 s |
| Hover park (trick start) | 180 | 42 s | 25 s |
| Physics yard (ball run) | 214 | 50 s | 30 s |

## Sightlines at eye height (portrait)

- **Plaza (`05`), Main Street (`06`):** still read as a town. The quest corner and obelisk fill the frame from the
  gate; Main Street is closed by the obelisk with both shops and their keepers in view.
- **Grapple (`10`):** the best toy frame: from outside the West Gate the tower, mast, tank, both hook poles and the
  zipline overhead read in one portrait shot.
- **Rock (`12`), riding (`11`):** read at once (cave mouth, scramble route, lookout, the climb yard's bridge; the
  gantry framing the rings down the straight).
- **Range (`07`):** reads looking across the lanes from the east end (targets at every distance, the ammo
  practice, the berm). The melee yard needs its own frame; portrait can't hold both.
- **Movers (`09`):** the run reads as one structure rising right to left, but at 50–110 m the stations are small. In
  portrait no single eye-height spot shows all six stations up close; standing at the start you see them stacked.
- **Hover park (`08`):** the weakest. Kickers and the halfpipe are low (1.6–4.5 m), so at eye height the park reads as
  a flat floor with ramps. It reads properly once you're on the board.

## Added, and what didn't fit

- **Added:** the climb yard (§2 item 11 had no home of its own), the physics yard (split from the hover park), the
  grapple course start, hook poles 1–2 and its finish, the riding lap-timer gantry, the crossbow ammo targets, the
  bowl, rails, quarter pipes and funbox, and a PB board at every course.
- **Couldn't fit:** nothing. 40,693 m² is still free.
- **Changed from round 3:** the movers spiral is now a straight run (it read as a tower, not a sequence). The Rock no
  longer touches the town, so the squeeze cave runs avenue → hover park instead of town cellar → park. The stable
  hand moved inside the Stable Gate so all six NPCs are in town.
- **Not west content:** the perimeter-strip hover time trial is content-out (§2), so it isn't drawn.
