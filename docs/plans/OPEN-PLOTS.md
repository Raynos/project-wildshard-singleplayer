# Plan: OPEN-PLOTS — build the other 18 open plots the way Night Market was built

**State:** `parked (draft, 2026-10-28): starts on Jake's word, after SHARD-PLATFORM archives (G824)`

Jake, 2026-10-28: *"You're approved to go and do the park plan, the draft park plan, how to build the rest of the open
plots."* This plan replaces Night Market pilot R1–R3 and remaster-open-plots RP2–RP4 (G774, G824). Decisions stay in
[shard-platform/decisions.md](shard-platform/decisions.md) until this plan has its own file. Read at HEAD 2f074203c9.

Sources: [night-market-pilot](shard-platform/night-market-pilot-mini-plan.md) (NM0–NM11),
[night-market-remaster](../../project/archive/2026-10-27-night-market-remaster.md) (RM0–RM14, the dome method),
[remaster-open-plots](shard-platform/remaster-open-plots-mini-plan.md) (the 19 ideas, the RM14 style-row how-to).
Approved mockups: `art/grid/round-62-open-plot-palettes/<nn>-<slug>.jpg` (G712, G714), four views each.

## 1. What Night Market proved

**The first pass was not enough.** The pilot (NM0–NM11, 10-23, one Opus lane overnight) built code boxes on the tile
grid. Jake, 10-24: *"looks like trash fire."* The quality came from the remaster (RM0–RM14, 10-24 to 10-27, about 10
Opus lane-days on 2 lanes plus Codex RM1–RM3). **So every plot below starts at remaster quality, never at pilot boxes.**

What worked, and what we keep:

- **The tile grid.** 8 × 8 tiles of 62.5 m, one per L0 streaming tile (G626, G641). The layout is data: eight strings of
  letter + turn (`data/layouts/night-market.json`). Every tile has a 4 m paved border, so any tile meets any tile.
- **Far from stand-ins only.** `worldSource.farMode: 'replace'` (NM0 `0814022f5d`). Each tile's far stand-in is
  ≤ 40 triangles; the whole far proxy is 7,175 of its 8k cap (RM11).
- **The dome method** (E503, G726). Four hero cameras (road entry, 40 m over the road, 100 m over the neighbour, plaza),
  a stand dome and a look dome each: 8 domes, 71 of 72 targets (G785). Capture 3×3 beside target 3×3, gap list, fix.
- **The shared kit** (RM4, RM14 `db62fede6c`). Nine Blender-script families in `public/assets/open-plots/kit/`
  (lanterns, stalls, houses, bridges, strings, props, canal, trees, figures; ~1.26 MB of GLB), three variants each,
  retinted by palette slot. Trims are ruled in the material, no texture (RM5.3). Paving is ruled too (RM5.1).
  A second idea's style row builds with no generator change (`test/open-plots-style-row.test.ts`).
- **Light without real lights.** Bloom 0.5 / 0.9 (RM6.1), smooth pools (RM6.2), the lantern vertex bake (RM6.3).
- **Bytes.** Quantized tiles at 17.7 B a triangle, ≤ 251 KB a tile (RM8.1 `850a6efb5f`); `detail_` / `coarse_` L1
  rows (RM8.2). Every L0 tile ≤ 13,170 triangles, mean 8,260 (RM8.6).
- **The landmark.** Hunyuan3D 2.1 beat TRELLIS.2 for the gate: 45 m, 12k near, 2.5k far (RM9.1).
- **Budgets met.** Simulator on `3a9c1ec9e0`: 30.3 fps, p95 34 ms inside the plot; 888 MB playing, peaks 1,117 MB
  playing and 1,197 MB loading. Chromium: 390k–560k triangles; draws 137–154, ratcheted (G785), 114–134 after the
  shadow cuts (`68d673dd67`). All inside G726's +300 MB and 1.2 GB per shard.
- **Jake's QA, 10-28** (G827, live a3f28a795, 30 fps, 0.90 GB, 2 worlds): *"Night market looks good."*

What Jake flagged:

- **Lanterns (G827):** *"too many floating lanterns ... way less lanterns ... connected by a very visible rope ...
  a lot higher detailed."* Row OP1.
- **Stream-in:** *"I wish you could stream in faster."* That is a tile-streaming item on BURN-DAMAGE-LIST, not here.
- **Figures (G755):** the image-to-3D people looked bad. They stay off; plots ship without figures.
- **Still open from RM12:** the road entry's long frames (shaders compile on arrival). Every plot inherits this risk.

**The lesson for reuse:** Night Market's kit is a market (Chinese houses, stalls, canals). What every plot can reuse is
the plumbing (grid, seams, slots, trims, paving, light bake, posters, far, map, dome captures) plus a few generic
families (trees, lanterns, props, bridges, water). Each plot still needs its own 2–4 hero families (G633 D2).

## 2. The plots

19 open cells on the 5 × 5 grid, 14 ideas today; Night Market, Frostline Peaks, Lantern Bayou, Ember Forge and
Mosslight Ruins fill two cells each. The five new ideas (G653) replace those repeats, so all 19 cells are unique and
**18 plots are left to build.** A new idea's row adds its `outputs.json` row and takes over one repeat cell.

| Idea | Cells | Style direction (round 62) | Hero landmark | Kit reuse | Effort (Opus h / Codex h) |
|---|---|---|---|---|---|
| Lantern Bayou | 2 → 1 | marigold dusk swamp, boardwalks, moss | lantern-hung cypress tree | high | 12 / 4 |
| Patchwork Fairground | 0 → 1 (new) | bright noon fair, striped tents, bunting | Ferris wheel | high | 12 / 4 |
| Showcase Template | 1 | clean teal expo, white paving, pools, hedges | glass-domed expo pavilion | med | 8 / 4 |
| Mushroom Hollow | 0 → 1 (new) | neon pink and teal night, glowing caps | toadstool tower | med | 16 / 5 |
| Saltwind Lighthouse | 0 → 1 (new) | grey rain, wet stone, fishing cottages | red-and-white lighthouse | med | 16 / 5 |
| Coral Drift | 1 | turquoise lagoon, sand, beach huts, palms | coral arch over the lagoon | med | 16 / 5 |
| Sky Harbor | 1 | cornflower sky, timber docks, cranes | moored airship and tower | med | 16 / 5 |
| Desert Ruin | 1 | sand noon, sandstone, palms, awnings | sandstone temple gateway | med | 16 / 5 |
| Jungle Ziggurat | 0 → 1 (new) | misty green jungle, rope bridges | overgrown step pyramid | med | 16 / 5 |
| Ember Forge | 2 → 1 | navy night, lava channels, black stone | dwarven forge furnace | med | 16 / 5 |
| Starfall Observatory | 1 | iris starry night, white domes, blue roofs | domed observatory and telescope | med | 16 / 5 |
| Frostline Peaks | 2 → 1 | periwinkle snow day, lodges, pines | snowy peak, lodge and ski lift | low | 22 / 6 |
| Mosslight Ruins | 2 → 1 | moss-green dusk, ruined stone, green glow | moss-glowing stone tower | med | 16 / 5 |
| Thin Ice | 1 | pale cyan noon, aqua ice, igloos, pines | ice spire on a frozen lake | low | 20 / 6 |
| Clockwork Canyon | 1 | tangerine canyon, brass, steam, falls | brass clock tower with gears | low | 22 / 6 |
| Pastel Alien Plain | 1 | lilac night, aurora, glowing plants | glowing alien monolith | low | 22 / 6 |
| Fossil Badlands | 0 → 1 (new) | striped mesas, dig tents, bone white | dragon skeleton | low | 22 / 6 |
| Floating Island Race | 1 | mint sky race, checkered flags, islands | race start tower and ring gate | low | 22 / 6 |
| **Total** | **18** | | | | **~306 / ~93** |

**Showcase Template: build it, first.** It is the plot OP3's template emits with only shared families and one landmark,
so it doubles as the worked example of the how-to. It is the cheapest plot and proves the template. (Question 6.)

Effort: high reuse ~12 Opus h (landmark 4, two bespoke families 4, look 2, far and map 1, fixes 1); med ~16 (three
families); low ~20–22 (four families, or terrain shape: a peak, mesas, floating islands, a canyon). Codex per plot: layout
and style row 2 h, dome targets 1–2 h, captures and readings 1–2 h.

## 3. The pipeline per plot

The same eight steps for every plot. One lane owns a plot until it is done (G804).

1. **Mockup round (Codex).** Ground the four hero cameras of the approved round-62 sheet: `cameras.json`, a floor plan,
   one codex `image_gen` 3×3 per dome (8 domes), into `art/<slug>/round-1-domes/`. No new direction: round 62 is it.
2. **Jake's A/B/C board (Opus).** One labelled iPhone-portrait board: three takes of the landmark (Hunyuan3D-2,
   TRELLIS.2, a second reference) beside the key tile family. It goes in the morning batch (G766). The lane keeps
   building its recommended take; Jake's pick steers it when it arrives.
3. **Layout and kit (Codex).** OP3's template writes the 8 × 8 layout, the style row, the `outputs.json` row, the look
   key and the map row. The layout passes the socket check; the plot builds with shared families only.
4. **Hero models (Opus).** The landmark and 2–4 bespoke families through `mockup-to-model`: Blender scripts for
   architecture, Hunyuan3D-2 or TRELLIS.2 for organic pieces, whichever looks better. Each gets a 4-angle board.
   A family another plot can use lands in the shared kit (RM14 rule 4).
5. **Look graph and palette (Opus).** Grade, bloom, sky, fill, ruled trims; each region within ΔE00 ≤ 8 of the targets
   (`scripts/palette-delta.py`). The plot keeps its own light; only Night Market keeps red-and-gold (G714).
6. **Far stand-ins and map top-down (Opus).** Stand-ins re-authored from the real kit (far ≤ 8k); the map row painted
   from the generator, part of the static build (G826).
7. **Readings (Codex captures, Opus fixes).** One Chromium reading per row by its own lane (G807): the 8 domes beside
   targets, draws, triangles, MB, fps; physics walk 0 stuck. The Simulator reading runs once, at the plan's end (G777).
8. **Jake plays it.** A labelled board (4 cameras × MOCKUP · NOW) and a 30 s road-to-plaza clip; the plot replaces its
   hologram on the grid when its row lands (no Debug row, G669); its SHARD SELECT card is Developer only, like Night
   Market's. His playtest is the check.

## 4. Rows

| Row | What | Owner | Size | Done when |
|---|---|---|---|---|
| OP1 | **Night Market lanterns (G827).** Board first: 3 takes of a hero paper lantern (ribs, paper, cap, tassel, inner glow; ~1.5k triangles LOD0, ~300 LOD1, instanced) and 3 rope styles. Then cut the lanterns to a few hundred, delete every sky lantern, hang every lantern on a thick, dark, sagging rope between posts or eaves; re-tune the light bake for fewer emitters | Opus | 6 h | Board sent; no floating lantern in the 8 domes; 30 fps and draws ≤ 154 hold; the new lantern is the shared family |
| OP2 | **Shared-kit extraction.** Split `kit.mjs` / `tiledPlot.mjs` into a plot-agnostic core (Soup, grid, sockets, writer, pools, posters, kerb, far, light bake, paving) and per-idea builder sets; Night Market's H/G/S/C/L/N/P move to its own set; letters map to builders per layout | Codex | 1 d | Night Market builds byte-identical; the style-row test builds a second idea with its own letters |
| OP3 | **Per-plot template generator.** One script: slug → layout stub, style row, `outputs.json` row, look key, map row, dome cameras from the round-62 sheet, cell swap for new ideas. Its first output is Showcase Template | Codex | 0.5 d | A new idea goes from nothing to a building plot (shared families, its palette) in one command |
| OP4 | **Batching.** One dome-capture run and one board-maker over any list of plots; one Chromium reading at a ring junction with all built neighbours in view | Codex | 0.5 d | One command captures 3 plots × 8 domes and makes their labelled sheets |
| OP5 | Showcase Template (wave 1; the template's proof) | Opus + Codex | 8 / 4 h | Pipeline steps 1–8 met (§3) |
| OP6 | Lantern Bayou (wave 1; reuses OP1's lantern and the strings) | Opus + Codex | 12 / 4 h | Steps 1–8; frees a repeat cell |
| OP7 | Patchwork Fairground (wave 1; new idea, reuses stalls and strings) | Opus + Codex | 12 / 4 h | Steps 1–8; takes a repeat cell |
| OP8 | Mushroom Hollow (wave 2; new) | Opus + Codex | 16 / 5 h | Steps 1–8; takes a repeat cell |
| OP9 | Saltwind Lighthouse (wave 2; new) | Opus + Codex | 16 / 5 h | Steps 1–8; takes a repeat cell |
| OP10 | Coral Drift (wave 2; builds the shared palms and lagoon water) | Opus + Codex | 16 / 5 h | Steps 1–8 |
| OP11 | Sky Harbor (wave 3) | Opus + Codex | 16 / 5 h | Steps 1–8 |
| OP12 | Desert Ruin (wave 3; reuses the palms) | Opus + Codex | 16 / 5 h | Steps 1–8 |
| OP13 | Jungle Ziggurat (wave 3; new) | Opus + Codex | 16 / 5 h | Steps 1–8; takes a repeat cell |
| OP14 | Ember Forge (wave 4; adds the lava water kind) | Opus + Codex | 16 / 5 h | Steps 1–8; frees a repeat cell |
| OP15 | Starfall Observatory (wave 4) | Opus + Codex | 16 / 5 h | Steps 1–8 |
| OP16 | Frostline Peaks (wave 4; builds the shared pines and snow) | Opus + Codex | 22 / 6 h | Steps 1–8; frees a repeat cell |
| OP17 | Mosslight Ruins (wave 5) | Opus + Codex | 16 / 5 h | Steps 1–8; frees a repeat cell |
| OP18 | Thin Ice (wave 5; reuses pines and snow) | Opus + Codex | 20 / 6 h | Steps 1–8 |
| OP19 | Clockwork Canyon (wave 5) | Opus + Codex | 22 / 6 h | Steps 1–8 |
| OP20 | Pastel Alien Plain (wave 6) | Opus + Codex | 22 / 6 h | Steps 1–8 |
| OP21 | Fossil Badlands (wave 6; new, the last repeat cell) | Opus + Codex | 22 / 6 h | Steps 1–8; all 19 cells unique |
| OP22 | Floating Island Race (wave 6) | Opus + Codex | 22 / 6 h | Steps 1–8 |
| OP23 | **Plan-end readings.** The official Simulator reading on the grid with every plot built: inside three plots and at a ring junction | Codex (Sim lane) + Opus fixes | 0.5 d | Every plot ≤ 1.2 GB, 30 fps floor; the page does not crash |
| OP24 | **Delete the hologram path (RP4, R3).** `hologram.graph.json`, `beam.graph.json`, the hologram, sign and old billboard assets and code, `farMode: 'add'`, `batch-holograms.sh`, `holo_post.py`, the old look materials | Codex | 2 h | No hologram code or asset left; net lines negative; push gate green |
| — | Jake plays the plots on live | Jake | — | His word |

Order: OP1 ∥ OP2 → OP3 → OP4, then waves 1–6 (OP5–OP22), then OP23 → OP24. OP1 goes first because every
later plot reuses its lantern and rope.

## 5. Waves

- **Three plots a wave, one Opus lane each** (G804: a lane owns its plot until it is done, then takes the next).
  Order is most kit reuse first, so each wave inherits the families the last one built. A plot that needs a new
  shared family (palms, pines, lava) is built in the wave before the plots that reuse it.
- **Codex runs a wave ahead.** While Opus builds wave N, Codex grounds the domes, writes the layouts and runs the
  baseline captures for wave N + 1, then the readings for wave N. Codex work is about a third of Opus's (~93 h vs
  ~306 h), so **3 Codex lanes are enough; 6 would idle** (Question 7).
- **Boards batch to the morning** (G766): each wave sends at most three landmark boards in one batch, one
  AskUserQuestion with option 1 "Skip for now". **Lanes never pause on a pick**: they build the recommended take, and
  the pick steers them when it arrives. A skipped pick stays `needs pick`.
- **Usage steps (G605).** The Opus lane count follows Claude weekly usage: 3 lanes under 70 %, 2 at 70 %, 1 at 80 %,
  0 at 90 %. A step-down stretches the calendar, never the bar.
- **Calendar, honestly.** Shared rows ~1.5 days. A wave is ~1–1.5 days with three Opus lanes (a med plot is ~16 Opus
  hours plus capture waits). Six waves: 6–9 days. Plan end ~0.5 day. **~8–11 days if three Opus lanes hold; plan on
  2–3 weeks** with usage step-downs and the fixes Jake's plays will ask for. Night Market took 5 calendar days for one
  plot while building all the tooling; this plan reuses that tooling.

## 6. Budgets

Every plot gets Night Market's measured budget (G726, G764, G785), on the phone tier at 2× render scale:

| Budget | Per plot | Night Market's reading |
|---|---|---|
| Memory | ≤ 1.2 GB per shard playing, ≤ 1.8 GB loading (G534, G556) | 888 MB playing, peaks 1,117 / 1,197 MB |
| Frame | 30 fps floor (Low Power Mode cap) inside the plot and at its road entry | 30.3 fps, p95 34 ms |
| Draws | ≤ 154 per frame, ratcheted at each plot's measured count; aim ≤ 130 | 137–154; 114–134 after shadow cuts |
| Triangles in view | ≤ 600k | 390k–560k |
| L0 tile | ≤ 15k triangles, ≤ 0.3 MB | ≤ 13,170, mean 8,260, ≤ 251 KB |
| L1 tile | ≤ 10k triangles, 2 draws | within caps (RM8.2) |
| Far proxy | ≤ 8k triangles, 1 draw (refuses the build) | 7,175 |
| New download per plot | landmark ≤ 0.5 MB near + 0.3 MB far, bespoke families ≤ 1.5 MB, poster ~0.1 MB; no new texture but the landmark's | gate 437 + 264 KB, poster 91 KB |

- **Shared bytes are paid once.** The kit families (~1.26 MB today) download once for all 19 plots.
- **The grid has no total cap** (G556), only "don't crash". OP4 and OP23 read a ring junction with every built
  neighbour in view, because neighbours' near views add up there.
- **No real lights; instancing only** (E271). No facade multi-draw anywhere.
- Caps are raised only to a plot's measured bytes, no slack (G764).

## 7. Questions for Jake

Asked in one batch with the question tool when the plan starts; option 1 is always "Skip for now".

1. **Scope.** 1 Skip · **2 All 18 plots, in six waves, each swapped in as it lands (rec)** · 3 A first wave of 3,
   then a new plan · 4 A first wave of 6. *Why: the method is proven; stopping after a wave idles lanes, and your
   plays steer each later wave anyway.*
2. **Style direction.** 1 Skip · **2 Build to the approved round-62 mockups; one A/B/C landmark board per plot (rec)** ·
   3 Three new full mockups per plot to pick from · 4 No boards at all. *Why: you approved round 62 already (G714);
   one pick per plot keeps the morning batch to three boards.*
3. **Budget.** 1 Skip · **2 Night Market's, per plot: 1.2 GB, 30 fps, ≤ 154 draws ratcheted, ≤ 600k triangles (rec)** ·
   3 Tighter: +150 MB and ≤ 120 draws · 4 Looser: anything under 1.2 GB. *Why: Night Market met it and passed your
   QA; tighter would cut the density that made it read.*
4. **Play.** 1 Skip · 2 Explorable places only, no play · **3 One short play loop per plot, as data on existing game
   content: light the bayou lanterns, fly Sky Race's rings, dig the fossil (rec)** · 4 A full quest line per plot.
   *Why: fun levels, not dioramas; existing hosts keep HOST-BAR clean; ~3–4 h per plot more.*
5. **Repeat cells.** 1 Skip · **2 Keep the five repeats until each new idea is built, then swap the cell in the same
   commit (rec)** · 3 Swap all five now to template plots with shared families. *Why: never put a half-built plot on
   the grid.*
6. **Showcase Template.** 1 Skip · **2 Build it first, as the template's worked example (rec)** · 3 Leave it as the
   hologram until the end · 4 Turn its cell into a sixth new idea. *Why: it is the cheapest plot and proves OP3.*
7. **Lanes.** 1 Skip · **2 3 Opus + 3 Codex (rec)** · 3 3 Opus + 6 Codex · 4 Opus only. *Why: Codex work is a third
   of Opus's; six Codex lanes would idle. Either Codex option makes this a Codex-lane plan, which AGENTS.md reserves
   for big multi-week plans; this one is.*
8. **OP1 lantern count.** 1 Skip · 2 ~60, only the avenues into the gate · **3 ~200: one rope run per lane segment,
   3–5 lanterns a rope (rec)** · 4 ~400. *Why: enough to light the market, few enough for a hero model; the board
   shows all three.*

## 8. Out of scope

- **The damage-list burn** ([BURN-DAMAGE-LIST.md](BURN-DAMAGE-LIST.md)), including faster stream-in (G827) and the
  road-entry shader hitch.
- **[HOST-AUDIT](HOST-AUDIT.md)** and any new host: the plots stay data plus build-time generators.
- **Repo size and worktrees**: Jake's own.
- Night Market's figures (G755 redo, off until his pick) and any change to the shared HUD.
