# Round 10 · dome B, round 1 (E169, 2026-09-25): the half dome the spawn LOOKS at

Jake: the spawn mockup (`round-6-baseline-hud/style-A-jiehua-neon.jpg`) stands on Lantern Square looking at the paifang
and the banyan 30–50 m ahead. A 9-angle loop from the spawn (dome A, `round-8-look-loop-*`) polishes the half dome
around the player; the half dome the player looks at gets polished from one side only. So two loops run into the same
clean room: dome A from the spawn, **dome B from an anchor under the gate and the tree**.

- Anchor **Q = (13.0, +125, −13.0)**: 11 m in front of the gate line, 3 m west of the stall's front, between two mahjong
  tables. From Q the paifang is 14 m away (yaw −31), the banyan 11 m (yaw +27), the stall 4 m (yaw +80).
- The 9 cameras are shots `domeb-1` … `domeb-9` in `src/dev/nine-dragon/shots.ts`: FP 1–6 portrait 402×874 @2, no HUD,
  no weapon (prop polish), time frozen at 6.5; 7–9 aerial diagonals 1600×900 (SW high, W over the Well, SE).
- Every round also re-shoots dome A's hero frame `spawn` (with the weapon): the proof that dome B's polish lands there.
- Capture: `scratchpad/domeb/cap.mjs views.json <round dir> --bench` through the lab's browser lock. From round 2 on it
  shoots a private snapshot of the working tree on its own vite (`:5263`): the shared `:5173` HMR-reloaded mid-run
  (dome A's edits) and round 2's first pass came back with a black frame 4 and the HUD back on.
- Targets: codex `image_gen` EDITS of each capture (`scratchpad/domeb/mkjobs.py` → `scripts/horizon-matte/run_codex.py`),
  two inputs: the capture + the style-A spawn mockup as the detail reference ("the game's own frame of this place from
  ~35 m further back; repaint image 1 at the same style and the same intensity of detail; keep the camera and every
  structure"). View 5 (back to the spawn) has no reference angle: the prompt says so and asks for consistent invention.
  All 9 landed in 72–148 s, all kept the geometry; **none re-rolled**.

| File | What |
|---|---|
| `capture-1…9.jpg`, `capture-spawn.jpg` | round 1, the baseline (the clean room as dome B found it) |
| `target-1…9.jpg` | the codex edits: the look target of every later dome-B round |
| `sheet-ingame-3x3.jpg`, `sheet-target-3x3.jpg` | rows: FP 1–3 · FP 4–6 (+ spawn) · aerials 7–9 |
| `palette-regions.json` | ΔE00 regions for these cameras (`scripts/palette-delta.py --regions …`) |
| `capture-stats.txt` | draw calls and triangles per frame; ms/frame at 1206×2622 |

## Gap list (capture → target), per view

1. **Paifang close.** Posts toy-orange (#cf4a39 vs #823c31); plinths and drum stones pink-white blobs (the lanterns'
   red spill on pale stone); **the 九龍 plaque is invisible** (a bug: its sign sat 5 cm inside its own board, and the
   side roofs reached over the centre bay); roofs hollow from below (no soffit); the posts poke through the eaves as
   orange knobs; target: dark weathered lacquer, carved Sumeru bases, dense dougong, painted beams, black/gold plaque.
2. **Banyan.** Canopy of faceted bright-green blobs (#5d8357 vs #343b32); trunk a thin fan of sticks; planter white;
   target: massive gnarled trunk of fused roots over a carved dark planter, curtains of aerial roots, dense dark
   canopy, red ribbons; the earth-god shrine a lit red pavilion. The stall's back is a flat orange glowing box.
3. **Left, gate line.** Plinths white; the square under-populated (6 walkers); target: 15+ people, dark stone.
4. **Right, stall + shops.** The stall reads as an orange box with one mannequin; target: a dai pai dong with a
   striped awning, menus, pots and steam, a cook, customers on stools.
5. **Back to the spawn.** Balustrade reads right (dome A tuned its value); square empty behind the tables.
6. **Up.** Hollow roof undersides, knobs; canopy blobs; target: painted soffits, bracket sets, lanterns.
7. **Aerial SW.** Roofs bright jade slabs; canopy flat shelves; square empty; stall a striped box.
8. **Aerial W.** Same; the gate's side roofs meet over the centre bay.
9. **Aerial SE.** Same; stall box; canopy low-poly.

Not in dome B's files (routed): the flagstones are 1–1.6 m slabs, the targets' ~0.6–0.9 m with puddles (`style.ts`
`stone()`, dome A); the sky screen's pixel grid (dome A); tower facades (dome A).

## TOP-10 (area × frames) and what happened in round 1's fixes (captured as round 2)

| # | Gap | Frames | Fix (file) | Status |
|---|---|---|---|---|
| 1 | Paifang lacquer + stone (toy orange, white blobs) | 1 3 6 7 8 9 | lacquer `#80261b` + gloss, gold bands `#b08a3c`; Sumeru bases (須彌座: slabs, carved die, lotus cushion), smaller ringed + bossed drum stones with a beast on top (`gate.ts`) | Fixed (cinnabar ΔE 16.7 → 7.5, stone 8.9 → 7.6) |
| 2 | Banyan canopy (faceted bright blobs) | 1 2 6 7 9 | 55 cloud shelves × 12–16 smaller lumps (lat 5 × lon 9), night greens, no accent (`banyan.ts`) | Partly (canopy ΔE 26.7 → 5.9; still reads low-poly: the organic lab's leaf work is the next step) |
| 3 | Roofs hollow / flat | 1 6 7 8 9 | thick roofs: a painted rafter soffit under every slope, raised tile rolls, painted eave boards with a gold rule, hip beasts, chiwen fins, the flaming pearl and two gold dragons on the ridge; posts stop under the dougong | Partly (structure fixed; the tiles now too bright a jade, ΔE 26.5 → round 2 fix) |
| 4 | 九龍 plaque invisible (bug) | 1 6 7 9 + spawn | plaque proud of its board in a raised gold frame with cloud bosses and a crown; side roofs narrowed and pulled outward so they no longer hide the centre bay | Fixed (reads in the spawn frame) |
| 5 | Stall = orange box | 2 4 7 9 | `stalls.ts`: steel frame, corrugated roof, striped awning with a scalloped valance, 麵 banner, lit name board, menu strips, shelves of jars, a fridge, stockpots + wok on a glowing burner, bowls, chopsticks, sauces, bulbs, lanterns, 2 cooks, 3 customers at the counter, 2 folding tables with 4 diners, gas bottle, crates; its warm light is an emitter (spill + streaks) | Fixed (stall light ΔE 9.3 → 5.9) |
| 6 | Square under-populated | 1 3 5 7 8 9 + spawn | +57 TRELLIS walkers in 4 zones (gate, centre, east strip, south) + 5 loiterers at the balustrade, placed by `walkable()` with the tables, Q, the spawn and the canyon camera kept clear; the procedural mannequins removed (`square.ts`) | Fixed |
| 7 | Banyan trunk thin, planter white | 2 6 9 | 22 braided roots round a 1.35 m core, every third spilling over the rim as a buttress, burls; 7 gnarled prop-root pillars with braided strands; 260 hanging roots; dark wet carved planter | Fixed |
| 8 | Earth-god shrine a red box | 2 | a lit red lacquer cabinet under a small tiled roof (the gate's roof code, ornaments scaled), candles, censer + incense smoke, oranges, couplets, lanterns, a paper-money burner; moved to the planter's south-west, clear of the stall | Fixed |
| 9 | Painted beams / dougong missing detail | 1 6 | three-tier dougong (坐斗, crossed arms, 升, slanted 昂) at 0.5 s spacing, 栱眼 panels; 旋子彩画 beams (end bands, cartouche, rosettes) | Fixed |
| 10 | Stone lions (brief) | — | a procedural pair built (`stoneLion`), but it reads as a lump: **off** until the organic lab's TRELLIS lion lands (`lions: false`) | Waiting (organic lab) |

Also: **the gate's red eave neon is off** (`neonEaves: null`): the style-A mockup and all 9 dome-B targets light the
gate with its lanterns only. It was round-4 A's idea; it is one argument in `square.ts` if Jake wants it back.
Balustrade stone to a mid wet grey (`#626469`, dome A's ΔE: the spawn target wants `#656469`).
