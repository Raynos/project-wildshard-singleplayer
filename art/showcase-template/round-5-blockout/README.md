# showcase-template / round-5-blockout: the Titan behind a portal, the gauntlet given room

Round 5 of the Kitchen Sink v2 grey blockout (round 4: `../round-4-blockout/`). **Only the SE bottom (x 8–237, z
122–237) and the hidden layers changed.** The west is round 4's; bands 1–6, their 60 packs, cover, chests, crates,
the road gates and the SE-wall gates are round 4's to the number (`node placement.js` prints the same fit tables).

Jake, 11-03: *"From the top view, the arena for the Crate Titan compared to the rest of the shard is just too small.
The Crate Titan is huge … Like Elden Ring or Dark Souls, there needs to be a boss portal … you enter a portal, and get
taken to an absolutely massive boss arena. Remember shard files are still 500×500, you can't cheat … Figure out how to
put the Gauntlet Arena in the 500×500, especially since the Titan is now a portal so some of that space can go to the
gauntlet."*

**Verdict: it fits.** The Titan's surface footprint drops from 5,160 m² to a **2,496 m² Titan gate** (a walled lane
and a plaza with the portal arch). The fight moves to a **hidden arena under the SE at y −150: a ⌀104 m floor, 8 m
wall, stands to ⌀140, for a 15 m Titan** (3.4× round 4's floor). The **gauntlet goes from 5,542 to 14,114 m²** (2.5×):
a forecourt and three sealed courts run through three gates, with 12,079 m² of fight ground (4.9× the old ⌀56 floor).
Nothing hidden intersects anything, everything stays inside x/z ±250 and above −250. 13.4 % of the cell is still free
(was 16.3).

| File | What it shows |
|---|---|
| `01-plan.jpg` | The whole cell; the SE bottom (dashed orange) is what changed; dashed blue = the hidden Titan arena and the vault; ⊙ portals; magenta = the gauntlet run |
| `02-se-close-up.jpg` | **The key image.** The SE bottom in two halves at ~3.3 px/m with every item labelled: forecourt, C1–C3, terraces, spawn doors D1–D6, gates G1–G3, the elite lift, the Foreman's balcony, cover, waves W1–W5, the Titan road and the Titan gate |
| `03-section.jpg` | Side section looking west, true scale: the surface, the Training Vault (y −40) and the Titan arena (y −150 to its sky at −80), with every depth; then the SE zoomed 3× |
| `04-titan-arena-plan.jpg` | The hidden arena from above with the Titan's reach at 9, 15 and 20 m; their front elevations against the wall and stands; the scale table |
| `05-titan-gate.jpg` | Eye height in the Titan gate plaza: checkpoint, plaque, return pad, the 18 m portal arch |
| `06-gauntlet-entry.jpg` | Eye height on C1's entry terrace (+3 m) as wave 2 comes in |
| `07-titan-arena-eye.jpg` | Eye height (third-person camera) in the hidden arena, 16 m from the 15 m Titan |
| `08-round-4-vs-round-5.jpg` | Round 4's SE bottom over round 5's, same scale, with the m² that moved |
| `09-budget.jpg` | Used vs free (round 4 in brackets), the SE ledger before → after, the gauntlet's fight ground per court |

To rebuild: `scripts/browser-lane.sh node art/showcase-template/round-5-blockout/capture.mjs [view,…]` (muted "iPhone
16 Pro", 402 × 874). `node art/showcase-template/round-5-blockout/placement.js` prints the fit tables, the budget,
`gauntletFit`, `gauntletView`, `titanScales`, `layerCheck` and the SE ledger. Every number is in `layout.js` (`GAUNTLET`,
`TITAN_GATE`, `TITAN_ROAD`, `TITAN`, `TITAN_ARENA`, `LAYERS`, R5 zones `08F`, `08A`–`08C`, `TG`).

## The gauntlet: three courts through three gates

The plan's line "five waves through three gates" now reads literally: a run of three walled courts, each a **sealed
wave room** (the shrine host's DG1: the gate behind you shuts when the wave starts, the next opens on the last kill;
DG2: a death restarts the court you died in, from its entry). It rises and falls: up onto C1's terrace, up again into
C2, down into the Foreman's ring.

| Court | Size | Stepped ground | Waves (live at peak) | Doors, specials |
|---|---|---|---|---|
| Forecourt `08F` | 80 × 19 | — | — | both SE-wall gates open into it; the checkpoint, the run board (5 waves, best time), the ramp up to the entry |
| **C1 Loading Yard** `08A` | 82 × 42, floor 82 × 34 | entry terrace +3 m (8 m deep), 2 ramps down | W1 4 Arc Sentries (4) · W2 4 Riveters + 2 Sentries (6) | D1 west, D2 east; 2 half walls, 3 crate stacks, a 6 m pillar; **G1** a ramp up to C2 |
| **C2 The Pit** `08B` | 82 × 44, floor 82 × 37 | entry ledge +2.5 m, 2 ramps down | W3 3 Riveters + 2 Sentries + a named elite (6) · W4 4 + 4 (8) | D3 west, D4 east; **the elite reveal lift** (6 × 6 m, rises +4 m under a banner); 2 pillars, 3 half walls, crates; **G2** east |
| **C3 Foreman's Floor** `08C` | ⌀84 (the plan's), floor ⌀56 | terraces +1.5 m (to r 34) and +3 m (to r 40), 4 stairs; wall 6 m | W5 Foreman Unit 7 + whistled Mites (max 6) + P2 Jack and Sentry (9) | D5 north, D6 south; **the Foreman's office and balcony** (+6 m, he whistles, then drops in); the trophy chest; **G3** out to the Titan gate |

**Why this size** (`gauntletFit`):

| | C1 | C2 | C3 |
|---|---|---|---|
| Floor + steps, m² | 2,788 + 656 | 3,034 + 574 | 2,463 + 2,564 |
| Peak live robots | 6 | 8 | 9 |
| m² per live robot (floor / with steps) | 465 / 574 | 379 / 451 | 274 / 559 |
| Share of the court inside a threat disc (r 8 m each) | 35 % | 45 % | 36 % |
| Far spawn door → floor centre | 41 m, 9.5 s | 43 m, 10 s | 42 m, 9.8 s |
| Two r 8 threat discs side by side across the short side | yes (34 m) | yes (37 m) | yes (56 m) |
| Longest sightline (bow 50 m, rifle 75 m) | 92 m | 94 m | 80 m |

- **Peak 9 live robots, every court**: under the phone's 12-awake cap and the 16-in-view cap. With no walls counted the
  worst portrait view is 18 (C3's north terrace looking over the Titan road into bands 5–6); every court's wall top is
  above the highest eye on its steps (C1 4.7 m eye / 5 m wall, C2 4.2 / 5, C3 4.7 / 6), so in play you see the wave
  alone: **≤ 9**.
- **Dodge room.** Assumed until EB tunes them: a Riveter's shockwave runs out to r 8 m, an Arc Sentry lunges 7 m, robots
  close at 4.3 m/s. At peak, at least 55 % of every court lies outside every threat disc, and the short side holds two
  discs abreast, so a slam ring and a lunge never pin you against a wall. The terraces are the ring-safe ground: the
  shockwave runs on its own level; Sentries follow you up the ramps.
- **Spawn doors 41–43 m out**: about 10 s for a wave to close, time for three or four bow shots on the way in; closer and
  the bow is dead weight, farther and waves feel empty.
- **Real wave arenas** (rough, from play and footage, ±30 %, not measured): Doom Eternal's arenas run ~40–80 m across on
  2–3 levels with monster-closet doors, ~150–300 m² per live demon for a player who dashes; Destiny's public-event and
  wave areas ~60–120 m; WoW's Nagrand Ring of Blood ~40 yd, Gurubashi Arena ~70 yd; Souls multi-enemy rooms (DS3's
  Demon Princes, Elden Ring's Godskin Duo) ~60–70 m circles. Our courts sit in that band at about half Doom's density,
  because a touch player sprints 7.2 m/s and has no dash.

## The Titan gate (surface) and the intro

A 14 m lane between 4 m crate walls, reached two ways (the Titan road from the forecourt, the shortcut; or G3 out of the
gauntlet), into a 39 × 38 m plaza in the very bottom right: **the last checkpoint**, the **L20 plaque** ("THE LAST
CONTRACT"), the **18 m portal arch** with a ⌀12 m portal (the boss fog) and the **return pad** where you come back
out. Vista ★ and a Gold 1×1 move to the arch top (round 4's "Titan rim" ones had no rim left); the gauntlet-rim Gold
moves to the Foreman's office roof.

**The 12 s intro plays inside, on arrival**, not at the portal: the Titan only exists in the hidden layer, and shot 1
(a still crate pile, `pov` ease to the centre), shot 2 (assemble), shot 4 ("high wide from the stands") all need the
arena; the portal's load fade hands straight into shot 1, so the cutscene also covers the region's load. Retries
respawn at the **inner checkpoint in the arena's south alcove** (Elden Ring's stake of Marika at the fog), get the 3 s
short intro, and never reload the arena. The alcove also holds the **exit portal** (back to the Titan gate). On the
win, the Titan Cleaver chest and a victory portal open at the centre; the shard-complete card plays on the return pad.

## The hidden Titan arena: 15 m Titan, ⌀104 floor

`titanScales` (portrait third-person camera 5 m behind you, ~36° wide, ~70° tall; written tells; sprint 7.2 m/s):

| Titan | × you | Arm sweep r | Escape from its shin | 0.9 s tell / scaled ×√(H/9) | Both fists in frame from | Arena ~7 H | Sprint across | 4×8 block |
|---|---|---|---|---|---|---|---|---|
| 9 m | 5× | 5 m | 3.7 m, 0.51 s | fair / 0.90 s | 6 m | ⌀63 | 9 s | 89 % of H |
| **15 m** | **8×** | **8.3 m** | **5.5 m, 0.76 s** | **fair / 1.16 s** | **13 m** | **⌀105** | **15 s** | **53 %** |
| 20 m | 11× | 11 m | 7 m, 0.97 s | **unfair** / 1.34 s | 18 m | ⌀140 | 19 s | 40 % |

**Pick: 15 m.** From sword range it is taller than the portrait frame (its head leaves the top inside 13 m), so it
reads as absolutely massive, yet it fights fairly on the tells as written (0.76 s to clear the sweep against 0.9 s),
the 4 × 8 block still reads as a thrown crate, and its four P2 Mites come off 1.5 m shoulder crates. 9 m is a big
elite. 20 m needs every tell slowed by a third, loses both fists from frame inside 18 m (sword players fight the floor
decals blind), and asks for a ⌀140 floor (19 s to sprint across a crate-rain phase).

**The arena** (`TITAN_ARENA`), centred under the SE at (150, 165): **floor r 52** (⌀104 ≈ 7 H; Souls arenas run roughly
6–9× the boss's height across, the open-field giants more), an **8 m wall**, **stands to r 70 rising 24 m** with four
floodlights (the intro's high wide shot), **four 10 m rolling lanes** on the diagonals for the P3 4 × 8 block (1.0 s;
out of a lane in 0.7 s at sprint), an **edge-leap band** at r 40–50 for P3's leap and its three rings (a 48 m leap),
four crate-stack covers at r 30 off the lanes, crate-rain rings anywhere, and the **south alcove** (inner checkpoint,
exit portal, fog gate). **Height: floor at y −150, a 6 m slab below (−156), its own sky up to y −80** (70 m clear: the
15 m Titan's leap apex ~22 m, crate rain from ~35 m, the stand camera at ~30 m).

## The layers don't meet (`layerCheck`)

| Layer | x | z | y |
|---|---|---|---|
| Surface (deepest: the squeeze cave, −6; tallest: the 45 m tower) | −250…250 | −250…250 | −6…45 |
| Training Vault interior (4 rooms) | 151…221 | −99…−29 | −40…−30 |
| Crate Titan arena (floor, stands, sky) | 80…220 | 95…235 | −156…−80 |

No pair intersects. The vault and the arena don't even share a footprint (124 m apart in z) and sit 40 m apart in y;
the arena's sky is 74 m below the surface's deepest point. Every box is inside x/z ±250 and above CELL_BELOW (−250).

## Budget (250,000 m², 1 m raster)

| Category | m² | % | Round 4 |
|---|---|---|---|
| Town | 14,400 | 5.8 | 5.8 |
| West toys + paddock | 67,776 | 27.1 | 27.1 |
| East level bands | 66,423 | 26.6 | 26.6 |
| East set pieces (now the gauntlet courts, forecourt and Titan gate) | 28,736 | 11.5 | 9.1 |
| Roads, strip, wall (+ the Titan road) | 39,104 | 15.6 | 15.2 |
| **Free** | **33,561** | **13.4** | 16.3 |

**The SE bottom (26,335 m²), round 4 → 5:** gauntlet 5,542 → 12,596 (courts) + 1,520 (forecourt); Titan amphitheatre
+ approach 5,160 → 0; Titan gate 2,496; Titan road 1,224; free 15,633 → 8,499 (corners round C3, the strips behind the
spawn closets, east of the lane). **Hidden:** the arena floor 8,495 m² (round 4's surface floor 2,463), its ⌀140
footprint 15,394 m², all at 0 m² of surface.

## What the portal needs from the platform

Nothing new beyond what the Training Vault already asks for: the walk-in portal ride (exists) into an interior region
of the same shard (the interior host W15 unifies, composed by the shrine rows DG1–DG4), placed inside the cell's own
footprint at y −150 (CELL_BELOW 250 allows it). The region loads on entry behind the portal fade, with the intro
covering the rest; it carries its own sky and light; the surface's near tiles stay resident so the exit is instant,
and retries respawn inside without a reload. On the phone it counts against the **1.2 GB per-shard cap** like any
streamed tiles: one Titan (~7k tris phone) plus instanced crates, walls and stands. The vault and the arena are never
loaded together (they are 124 m apart and each loads only through its own portal), so the shard's peak is the surface
plus one interior; that peak needs a measured reading once it's built.

## What moved, what didn't fit

- **Moved:** the Titan amphitheatre and its approach (now the hidden arena and a small gate); the gauntlet (one ⌀84 disc
  → forecourt + three courts); Foreman Unit 7 to C3 (146, 186); the Titan quest marker to the plaza; vista ★ "Titan rim"
  and its Gold to the arch top; the "gauntlet rim" Gold to the Foreman's office roof. The two SE-wall gates stay where
  they were; both now open into the forecourt.
- **New:** the Titan road (12 m, the shortcut to the gate), spawn closets behind six doors, the elite reveal lift, the
  Foreman's office and balcony, the run board, three checkpoints (forecourt, Titan gate, arena alcove).
- **Didn't fit:** nothing. 8,499 m² of the SE bottom stays free, but in scraps (round C3, behind the closets, east of the lane); a bigger court would come from pushing C1 and C2 west to x 8.
- **Proposed, not decided:** the Titan road opens from the inside after the first gauntlet clear (a Souls shortcut), so
  the Titan is first reached through G3; the named elite in wave 3 needs a name (EB's call); the threat sizes (r 8 ring,
  7 m lunge, 4.3 m/s) are assumptions until EB tunes them.
