# Open plots build-out: five hero-image plots, graphically better than the Night Market

> **Re-scoped 2026-11-02 to the tile approach (G978).** Jake: *"the open plots idea is for them to be blocky and
> symmetric … made out of tiles so that you can mix and match, so that you can build these open plots quickly … We're
> supposed to not sink an ungodly amount of tokens and efforts into making fully custom 500x500 zones."* What changed:
> each plot is now **the shared tile kit + its palette + ONE landmark + 2–3 theme tile variants**, laid out as a
> mirror-symmetric 8 × 8 of mix-and-match tiles, in OPEN-PLOTS' spirit and budgets. Kept as the bar: the landmark, the
> four hero views, dressing density, audio and phone perf. Dropped: bespoke 500 m zones, 3–4 bespoke families × 3
> variants, two secondary landmarks per plot, the 8-dome 68 / 72 target count and the ΔE00 ≤ 8 match to a painting
> (the round-62 board is a look target judged by eye, not a colour oracle). Size: **Opus ≈ 9.5 lane-days (was ≈ 20),
> Codex ≈ 7 (was ≈ 9.5)** for the five; the four new plots add ≈ 1.5 Opus + 0.5 Codex each (§8).

**State:** `open` (grilled 11-02 ~23:20, G975 / G976: art builds start after SHARD-PLATFORM archives; grid data rows now); was `draft` 2026-11-02 for Jake's grill. A mini plan under [OPEN-PLOTS](../OPEN-PLOTS.md), which is parked
until SHARD-PLATFORM archives (G824) unless Jake pulls it forward. Ask E521. Written by wildshard-v's planning
subagent at HEAD d795fa9dfe. G971–G973 are applied: no gameplay, Nine Dragon at (1,-1), one grid, and Showcase
Template later.

Jake, 2026-11-02 (E521): *"use a sub-agent to plan out a new mini plan, how you would build out the open plots to the
same level as night market or better for those 5 to 6 that I see in that hero image."*

Jake, 2026-11-02 (G971): *"There's no play loop … There's no quest, verb, or encounter. It's just a placeholder … it's
just the tiles. It's just a 3D content … I just want it to be graphically better than Night Market. I just want it to
be designed better. I just want the little mini world for this open plot to be better. Identity, yeah, that's great …
signature landmark is important, themes is important."*

**Row ids are `OB`** (build-out). OPEN-PLOTS already uses OP1–OP24. For these five plots, this plan replaces the bar
and size of OPEN-PLOTS rows OP6 (Lantern Bayou), OP10 (Coral Drift), OP14 (Ember Forge), OP16 (Frostline Peaks) and
OP17 (Mosslight Ruins). It depends on OPEN-PLOTS OP1–OP4 (§5). OPEN-PLOTS' coordinator re-points those rows after the
grill. This file edits no other plan.

## 1. The plots and their cells (after G970–G973)

Title hero: `public/assets/title/main-crossroads-square.jpg`. The camera is over Nalati and looks toward Driftwood.

| Plot | Cell it keeps | In the hero? | Neighbours |
|---|---|---|---|
| Frostline Peaks | (-1,-1) | yes. Today Developer draws the blender-template there (`grid.developer`); G972 removes that | Far Reach, Sunscar, Lantern Bayou, a new plot |
| Lantern Bayou | (-2,-1), its only copy now. (1,-1) goes to Nine Dragon (G972) | yes | Coral Drift, Frostline, a new plot |
| Coral Drift | (-2,-2), the corner | yes | Lantern Bayou, a new plot, the sea edge on two sides |
| Ember Forge | (2,-1). (-2,0) gets a new plot (G973) | no: behind the camera; the hero's (-2,0) becomes a new plot | Nine Dragon, Mosslight, Alien Plain |
| Mosslight Ruins | (2,0). (-2,1) gets a new plot (G973) | no: same; the hero's (-2,1) becomes a new plot | Nalati, Ember, Clockwork Canyon |

The hero's sixth open slab is a twin cell that a new plot takes (§8). Every plot is built once, for one cell.

## 2. The bar: "Night Market or better", measured

Night Market is the reference: Jake passed it at QA (G827) and later called it *"placeholder open plot slop"*. These
five must beat it on every line below, built the tile way (G978). The plots have no gameplay (G971), so the bar is graphics, audio and phone
performance.

| # | Measure | Night Market today | Bar for each of the five |
|---|---|---|---|
| 1 | Signature landmark | One gate: 45 m, Hunyuan 2.1, 12k triangles near / 2.5k far. It reads as a dark silhouette until lit (RM §1b #8) | One hero landmark, 15–25k triangles near, ≤ 6k coarse, ≤ 2.5k far. Lit by its own emitters or by sun, never backlit flat. It reads from the road entry and from 100 m over the neighbour |
| 2 | Tiles, not a bespoke zone (G978) | 8 × 8 letter layout, one market kit | A mirror-symmetric 8 × 8 of mix-and-match tiles from the shared kit (OP2) retinted by the plot's palette row, plus 2–3 theme tile variants. The plaza gate is the shared gate tile, retinted. No bespoke secondary landmark, no hand-placed one-off tile |
| 3 | Hero views | 4 cameras, 8 domes, 71 / 72 targets (G785) | The 4 round-62 views (above neighbour, road entry, top-down, plaza), captured once beside the plot's 2 × 2 board. No dome-target count (G978) |
| 4 | Look | ΔE00 misses at plan end: sky 18.7, paving 10.6, roof 9.8 against ≤ 8 (BURN D111) | The palette row's slot colours, sky and grade are taken from the 2 × 2 board and judged by eye at the four views: it reads as its own palette and never as a neighbour's. No ΔE00 gate (G978: no matching a painting) |
| 5 | Better than Night Market, by eye | — | A labelled board: the plot NOW beside Night Market NOW and its MOCKUP, at the same four cameras. The lane's own read must be "clearly better", and Jake's play is the check |
| 6 | Dressing density | 9 shared families × 3 variants. L0 mean 8,260 triangles, max 13,170 | Shared families plus the plot's 2–3 theme tile variants. L0 mean ≥ 8k, max ≤ 15k. No tile under 4k triangles except open water. Every tile carries ≥ 2 families |
| 7 | Life | RM10's life (sky lanterns, steam, fireflies, banner sway) is not visible in the 5 s road-entry clip (BURN D112) | ≥ 2 motion sources visible in the road-entry 5 s clip, from existing kit systems only (flicker and pool graphs, sway, scrolling emissive, instanced movers) |
| 8 | Lights | Floating lanterns (G827) | Every emitter hangs on or stands on geometry: rope, post, eave or bracket. No free-floating light. The light is baked, with no real lights (RM6.3) |
| 9 | Figures | Off (G755) | Off. No image-to-3D people. If G755's Blender figures ship first, a plot may add them |
| 10 | Audio | `ambience: none`, `score: none` (`open-plots/manifest.json:17`) | One score loop (MiniMax Music 3), one ambience bed and ≥ 4 positional spot SFX, each made with MOSS-SoundEffect v2 and Stable Audio 3 Medium with the better take shipping. Credits are kept as licence conditions |
| 11 | Walk-around | Physics walk 0 stuck | Real 3D from every hero camera. Physics walk 0 stuck. The plaza, bridges and landmark base are walkable |
| 12 | Draws (phone tier, 2×) | 137–154, then 114–134 after the shadow cuts | ≤ 130, with 150 as the hard cap (G937). ≤ 30 µs render CPU per draw. Ratcheted at the measured count |
| 13 | Frame | Sim 30.3 fps, p95 34 ms (`3a9c1ec9e0`) | Sim 30 fps floor (p5 ≥ 27), p95 ≤ 34 ms inside the plot and at its road entry. Frame cost ≤ Night Market's at matched poses (Chromium 4×), Night Market being the "legacy" for G937 |
| 14 | Memory | 888 MB playing. Peaks 1,117 playing / 1,197 MB loading | ≤ 1.0 GB playing as the aim. Hard limits 1.2 GB per shard and 1.8 GB loading (G534, G556) |
| 15 | Triangles in view | 390k–560k | ≤ 600k (G726) |
| 16 | Load size | 0.78 MB own, plus the 1.26 MB shared kit | ≤ 1.5 MB of new GLB per plot: landmark ≤ 0.8 MB near + far, theme tile variants ≤ 0.6 MB, poster 0.1 MB (OPEN-PLOTS §6). Audio ≤ 3 MB, streamed after the first frame. No textures except the landmark's |
| 17 | Shaders | Programs compile on arrival at the road entry (RM12, still open) | ≤ 8 classic-GLSL material families per plot (G934). No TSL graph looks. No long frame > 100 ms at the road entry in the Chromium reading |
| 18 | Debug rows | — | None (G952). A plot swaps in for its hologram when its row lands (G669) |

## 3. The five plots

The look direction for each plot is its approved round-62 sheet (`art/grid/round-62-open-plot-palettes/<nn>-<slug>.jpg`,
G712 / G714). Only Night Market keeps red-and-gold. Sizes are in **lane-days** (about 8 h of one lane) and include
capture waits and one fix round. **G978:** each plot is the shared kit + its palette row + ONE landmark + 2–3 theme
tile variants in a mirror-symmetric 8 × 8; anything another plot can use lands in the shared kit.

### Frostline Peaks, (-1,-1): alpine morning (`16-frostline-peaks.jpg`)

- **Identity:** a snowbound alpine village round a single peak. Cobalt sky, long blue snow shadows. Timber lodges with
  snow-loaded roofs, dense snow-dusted pines, frozen blue canals crossed by timber bridges, stone-and-iron lamp posts.
- **Signature landmark:** a granite peak about 70 m tall on the 2 × 2 plaza, with a summit lodge and a chair lift (three
  towers and instanced chairs that move). It is the tallest open-plot landmark, so it is held for the whole cell (§6).
- **Plaza gate:** the shared gate tile, retimbered, with snow caps and hanging iron lanterns.
- **Reuse:** OP1's hero lantern (as iron lodge lanterns), bridges (re-timbered), props, ruled paving, light bake, posters,
  the far stand-in tooling.
- **New (G978: one landmark + theme tiles):**
  - the landmark: the peak with its summit lodge and lift (Hunyuan3D-2 rock mass with snow coloured by normal, or a
    Blender sculpt script, the board decides; lift towers and chairs as one Blender script);
  - theme tile variants: a lodge tile and a **shared pine** tile (for Thin Ice later);
  - the snow ground rule and the **ice water kind**, both shared kit rules.
- **Life:** lift chairs moving, chimney smoke, wind-blown snow glints, pine sway.
- **Audio:**
  - score: bright alpine morning, zither, glockenspiel, soft strings;
  - ambience: wind and a distant lift hum;
  - spots: lift-wheel creak at each tower, hearth crackle at lodges, ice creak by the canals, wind chimes on the gate.
- **Size:** Opus 2 · Codex 0.5 (was 4.5 · 1.5). The peak is the biggest landmark of the five.

### Lantern Bayou, (-2,-1): blue-green dusk swamp (`18-lantern-bayou.jpg`)

- **Identity:** a stilt-house village on a mirror-dark swamp at blue-green dusk. Mist, lily pads, reeds, boardwalks,
  small warm lanterns. Blue-green dominates; the lanterns are small accents. G712 said *"too many have the same
  orange/red glow as Night Market"*, so the palette row keeps the sky and water blue-green.
- **Signature landmark:** a giant moss-draped cypress, about 40 m tall, with about 40 hero lanterns, each hung on a visible
  rope from a branch (the G827 rule).
- **Plaza gate:** the shared gate tile in cypress wood.
- **Reuse:** the highest of the five:
  - OP1's lantern and rope, and the string lights;
  - bridges, retimbered as boardwalks;
  - the canal water, retinted to swamp;
  - Night Market's Hunyuan trees (G755: *"The trees look alright"*);
  - pools, light bake and paving rules.
- **New (G978):**
  - the landmark: the cypress (Hunyuan3D-2 vs TRELLIS.2, since it is organic), moss as opaque low-poly strands;
  - theme tile variants: a stilt-house tile and a lily-pad-and-reed water tile.
- **Life:** fireflies, drifting mist planes, moss sway, lantern flicker, slow water shimmer.
- **Audio:**
  - score: slow dusk, slide dobro, soft accordion;
  - ambience: frogs, crickets, lapping water;
  - spots: boardwalk creak, wind chimes on the stilt houses, a distant owl, a lantern-boat bump at the jetty.
- **Size:** Opus 2 · Codex 1.5 (was 3.5 · 2). As the pilot, Codex also builds the template additions in OB2.

### Ember Forge, (2,-1): charcoal night, lava only (`17-ember-forge.jpg`)

- **Identity:** a dwarven foundry at deep-blue night. Black basalt halls, cold blue lamps, ore heaps with cranes, and
  molten orange lava as the only warm colour, in an L-cross of channels.
- **Signature landmark:** the forge furnace hall, about 35 m, with four glowing chimneys trailing smoke and a great lit
  door.
- **Plaza gate:** the shared gate tile in basalt with blue lamps.
- **Reuse:** paving rules, props, bridges (re-stoned over lava), the light bake (blue emitters, with lava as an
  emitter), pools.
- **New:**
  - the **lava water kind**: a scrolling emissive GLSL family, shared with any later volcanic plot;
  - the landmark: the furnace, a hard-surface Blender script, with a Hunyuan3D-2 take on the board;
  - theme tile variants (G978): a forge-hall tile and an ore-heap-and-crane tile.
- **Life:** lava flow, chimney smoke and rising sparks, a slow crane swing (instanced mover), flickering blue lamps.
  There is no heat-haze post effect (frame cost).
- **Audio:**
  - score: low brass over a steady anvil rhythm;
  - ambience: furnace roar and lava bubbling;
  - spots: anvil strikes at the halls, bellows, crane chain clank, steam hiss.
- **Size:** Opus 1.5 · Codex 0.5 (was 3.5 · 1). **Neighbour risk:** it sits beside Nine Dragon, the heaviest shard (§6 junction J1).

### Mosslight Ruins, (2,0): grey-green overcast, emerald glow (`19-mosslight-ruins.jpg`)

- **Identity:** a ruined stone city under a grey-green overcast. Broken arches and wall stubs, ivy everywhere, stepped
  terraces, four glowing emerald pools, green lamps.
- **Signature landmark:** a ruined round tower, about 35 m, with glowing moss in its windows, ivy-wrapped, on a rock
  outcrop at the plaza.
- **Plaza gate:** the shared gate tile as an ivy-hung stone arch.
- **Reuse:** the pool graph (emerald retint), the water kind, trees, ruled paving (cracked flagstones), props,
  OP1 lantern posts (green).
- **New:**
  - the landmark: the tower (Blender masonry on a Hunyuan3D-2 rock outcrop);
  - theme tile variants (G978): a **shared ruin-stone** tile (arches, wall stubs, rubble; Desert Ruin reuses it) with
    opaque ivy strands, and an emerald-pool tile.
- **Life:** glowing motes over the pools, pool shimmer, vine sway, slow cloud drift.
- **Audio:**
  - score: misty and ancient, low choir pads, harp, distant bells;
  - ambience: wind through stone and dripping water;
  - spots: pool hum, birds in the ivy, wind whistle at the arches, falling grit.
- **Size:** Opus 1.5 · Codex 0.5 (was 3.5 · 1).

### Coral Drift, (-2,-2): turquoise tropical noon (`10-coral-drift.jpg`)

- **Identity:** a lagoon village at tropical noon. White sand, turquoise pools, timber piers, blue-roofed stilt beach
  huts, palms, pink-peach-lilac coral clusters. Two sides face the sea edge, which suits the corner cell.
- **Signature landmark:** a giant faceted coral arch, about 25 m, over the central lagoon.
- **Plaza gate:** the shared gate tile in sun-bleached timber.
- **Reuse:** bridges (as piers), lamp posts, props, the water kind, ruled paving (sun-bleached boards).
- **New:**
  - the landmark: the arch, Hunyuan3D-2 vs TRELLIS.2 vs a faceted Blender script (the faceted mockup may favour
    Blender);
  - theme tile variants (G978): a beach-hut tile, a **shared palm** tile (Desert Ruin reuses it) and a coral-pool tile;
  - the **lagoon water kind** with caustics and shore foam, a shared kit rule.
- **Life:** caustics and shore lap, palm sway, gulls (instanced, if cheap), flag flutter on the piers.
- **Audio:**
  - score: bright noon, steel drum and ukulele;
  - ambience: surf and breeze;
  - spots: gulls, palm rustle, pier creak, wind chimes at the huts.
- **Size:** Opus 1.5 · Codex 0.5 (was 3.5 · 1).

## 4. The pipeline per plot

These are the house steps. One lane owns a plot until it is done (G804). The coordinator decides picks on the
recommendation and logs them (G872); no lane waits on a board.

1. **Live capture.** Today's cell at the four round-62 cameras, through `scripts/browser-lane.sh`, muted, as "iPhone 16
   Pro" (Codex).
2. **Mockups (Opus).**
   - Round 62 stays the look target; there is no new direction.
   - New mockups are made only for what round 62 lacks: the landmark close-up and the theme tile variants.
   - Qwen-Image-2.1 turbo (`scripts/mockup-local.sh`) is for fast iteration; codex `image_gen` is for the fidelity
     takes, grounded in the live capture.
   - They go in `art/<slug>/round-1-<label>/`, committed as JPEG.
3. **Pick board (Opus).**
   - One labelled A / B / C iPhone-portrait board per plot, with labels burned in: three landmark takes (Hunyuan3D-2,
     TRELLIS.2, Blender) beside the key theme tile.
   - It goes in the morning batch (G766); option 1 of the question is "Skip for now".
   - The lane builds its recommended take, and a pick steers it when it arrives.
4. **Models (Opus), via the `mockup-to-model` skill.**
   - A reference sheet and detail list for each model.
   - Pipeline: Blender scripts for architecture, Hunyuan3D-2 / TRELLIS.2 for organic shapes, whichever looks better.
   - LODs (near / coarse / far) and a 4-angle board each.
   - The GLB is committed; a `.blend` never is.
   - A family another plot can use lands in the shared kit (`public/assets/open-plots/kit/`, RM14 rule 4).
   - Only the landmark and the 2–3 theme tile variants are new models (G978); everything else is the kit, retinted.
5. **Layout as data.**
   - Codex: OP3's template writes the stub (`data/layouts/<idea>.json`, the style row, the `outputs.json` row, the look
     key and the map row) with shared families only.
   - Opus owns the final 8 × 8 rows, because they decide what the player sees (G848). The layout is mirror-symmetric
     (one quadrant written, mirrored), as in the plot's 2 × 2 board.
   - The audio rows are data in the manifest (Codex).
6. **Look (Opus).** The palette row's slots, grade, bloom, sky and fill, picked from the 2 × 2 board and judged by eye
   (no ΔE00 gate, G978). Then the far stand-ins, re-authored from the real kit, and the map top-down from the generator.
7. **Hero captures.** One capture run (OP4) per plot at the four round-62 cameras (Codex runs it, Opus fixes). A board
   shows the four cameras × MOCKUP · NOW · NIGHT MARKET (bar 5), plus a 30 s road-to-plaza clip (about 2–4 MB, 540 px).
8. **Phone perf proof.**
   - A Chromium phone-tier reading per plot (Codex): draws, triangles, MB, frame, long frames at the road entry.
   - The physics walk reports 0 stuck.
   - The official Simulator reading runs once, at the plan's end (G777), through `scripts/sim-lane.sh`.
   - Jake's phone check is last (G558).

## 5. Rows

Prerequisites, owned by OPEN-PLOTS and run first if not yet done:

- OP1, Night Market lanterns and rope (Opus 0.75 d). The bayou and the lodges reuse that lantern.
- OP2, shared-kit extraction (Codex 1 d).
- OP3, per-plot template generator (Codex 0.5 d).
- OP4, batched dome captures and boards (Codex 0.5 d).

| Row | What | Lane | Size | Done when |
|---|---|---|---|---|
| OB0 | **done (2026-11-03, G984; `8b7168fce9` + `53dd955063`, WebKit `53dd955-mw0atk0y`). On SHARD SELECT.** Frostline Peaks, Lantern Bayou, Ember Forge, Mosslight Ruins and Coral Drift each get a SHARD SELECT card (existing thumbs) that enters the plot standalone, public build too | Codex | 0.5 | Each of the five enters from SHARD SELECT on WebKit (iPhone 16 Pro); a test pins the five cards |
| OB1 | **done (2026-11-03, G972; `ffb6270346` + `913b810625`).** **G972, one grid.** `src/game/grid/singleplayer.json`: `nine-dragon-stack` takes (1,-1) in `grid.cells` (it replaces that Lantern Bayou copy), and `grid.developer` is deleted along with every reader of it (`src/game/grid/catalogue.ts`, `assembly.ts`, `copyIdentity.ts`, `entryDownloads.ts`, the grid tests, and the scripts that read it: `public-grid.mjs`, `frame-floor.mjs`, soak, parity, the world-map atlas and others; grep before deleting). Blender-template, pastel-plain and ink-cel-valley leave the grid. Fold the now-redundant `devserver` Nine entry if nothing else needs it | Codex | 1 d | One grid for public and Developer. Nine enters from its cell on a public build. The grid tests, `vitest related` and the boot smoke pass. Net lines are negative |
| OB2 | **Pilot: Lantern Bayou** through pipeline steps 1–8. **Codex tools done (2026-11-03):** template audio requests `ee85143593`; live bar-7 pixel check `a19c4cae2f`; plot-slug bar-5 board command `8bc2037c69`; five-plot G950 reports `10fe65fdb1`; five native entry/bridge/plaza/landmark walks, all 0 stuck, `d74cab106c`. Ember live pixel check reports FAIL (one changing region); visible life and OB7 playback remain open. Opus: the plot itself, and holding the landmark for the whole cell (§6) | Opus 2 + Codex 1.5 | 3.5 lane-days (was 5.5) | Board sent; the four hero views read as the 2 × 2 board, by eye; the layout is mirror-symmetric kit tiles plus ≤ 3 theme tile variants and one landmark (G978); the three-way board reads "better"; life visible; audio plays; ≤ 130 draws, ≤ 600k triangles, ≤ 1.0 GB in the Chromium reading; 0 stuck; the plot replaces its hologram |
| OB3 | **Frostline Peaks** (wave 2; builds the shared pines, snow and ice). Life (bar 7, `3f18b9d190`): frost-white snow glints off the summit lodge (`landmark.glints`), 338-369 px per 500 ms at the road entry, plus the lamp flicker (art/frostline-peaks/round-3-life) | Opus 2 + Codex 0.5 | 2.5 (was 6) | As OB2. The peak lodge and lift are readable from the road entry and from the Far Reach side |
| OB4 | **Ember Forge** (wave 2; builds the lava kind). **In flight (2026-11-03, sp-o3, from sp-o2): activated `c33dc15dcc`.** Kit `forges`/`ore` and furnace script take GLBs `50e156f0d8`, lava kind `ef19f9487b`, F forge court + O ore yard tiles and a lava moat of canals, look loop R1-R2 `837135050d` (art/ember-forge/round-1-look-loop), final three-way board art/ember-forge/round-2-final (G872). Wire 3,688,268 B, no tile debt. Furnace pick (art/ember-forge/round-3-landmark): A, Hunyuan3D 2.1, replaces the Blender script (wire 4,291,954 B, approved). The road entry sees it lit (`coarseLandmark: "lit"`, board-road.jpg). Life (bar 7): embers off the stacks, 190-210 px per 500 ms at the road entry, plus the lamp flicker (board-life.jpg). Open: audio (OB7), the open-plot walk route, J1, scale and density toward round 62 | Opus 1.5 + Codex 0.5 | 2 (was 4.5) | As OB2, plus junction J1 holds (§6) |
| OB5 | **Coral Drift** (wave 2; builds the palms and the lagoon water) | Opus 1.5 + Codex 0.5 | 2 (was 4.5) | As OB2. The sea-edge sides read at the 100 m view |
| OB6 | **Mosslight Ruins** (first free Opus lane; builds the ruin-stone tile). **In flight (2026-11-03, sp-o3): activated `38b95ef7fd` + `3748dcc5b1`.** Ruin-stone kit `330bed66fc` (ruins: arch, L wall, terrace; rubble: heap, columns; Desert Ruin reuses them), plot `f5b29be288` (R ruin court, E emerald pool, tower windows as emerald Glow), landmark A Hunyuan3D 2.1 picked (G872, `eba2a44862`, art/mosslight-ruins/round-1-landmark). Chromium phone: road 110 draws / 249k tris, plaza 114 / 327k. G983 look loop R1 `d3f8c7cc97`, R2 `e164db2efb`, R3 `def30fc8f4` (art/mosslight-ruins/round-2-look-loop), final three-way board art/mosslight-ruins/round-3-final (G872). Life (bar 7, `3f18b9d190`): emerald motes off the tower (`landmark.motes`), 166-189 px per 500 ms at the road entry, and the court motes in the steady emerald mode instead of blinking to black (art/mosslight-ruins/round-5-life). The road entry sees the tower lit (`coarseLandmark: "lit"`, `acc0a955d6`, board-road.jpg; four plaza L1 tiles draw 3). Open: audio (OB7), the open-plot walk route (0 stuck), density toward round 62 | Opus 1.5 + Codex 0.5 | 2 (was 4.5) | As OB2 |
| OB6b | **done (2026-11-03).** **Trim Mosslight's phone wire** toward Night Market's: 8,947,522 B against 8,225,190 (+9 %, approved G872 with this row). `def30fc8f4` brought it to 8,828,397 B (tower texture 768 px). It now serves **8,222,060 B**, and the ceiling is ratcheted to that: a 576 px poster in place of the 1024 px billboard, and the tower texture at 704 px. Before and after board: art/mosslight-ruins/round-4-wire-trim (hero views 0–0.5 % of pixels changed, same draws). Mosslight's tile debt shrinks to 26 rows | Opus | S | ≤ 8.23 MB, look unchanged |
| OB7 | **Audio batch** under the model lock. Pilot first, then the four: 5 scores (two MiniMax Music 3 takes each, on one listening page in the morning batch; the lane ships its recommended take), 5 ambience beds, about 25 spot SFX (MOSS v2 vs Stable Audio 3, the better take ships). Files go in `public/assets/music/<slug>/` and `public/assets/sfx/<slug>/`, with credits | Codex | 1.5 | Every plot meets bar 10; the credits file is updated; the audio stays within its ≤ 3 MB budget |
| OB8 | **In flight (2026-11-03, sp-x1).** Pinned final-look readings for Mosslight, Ember, Frostline and Bayou pass measured frame/draw/triangle/memory bars and maintained walks. Mosslight/Frostline life refresh at `03ad135a92`: Chromium ≤61/63 draws, Sim ≤65/65, all p95 34 ms, native playing 234.2/258.4 MB; existing model/browser overlap recorded below. Earlier J1/J2 pass on `0c3e3ca16b` (69/82 max draws). Current Ember/J1 refresh at `c8b9be9d42`: Ember accepted; the authorized clean J1 −135 confirmation passes (59 max draws, 134,734 median triangles, 30.303 fps, p95 34 ms), closing `OB8-J1-FRAME` without routing. Earlier contention-overlap failure retained below. **Open:** final Coral reread after its final board. Ancillary grid home spawn misses 181 draws vs 150 (`OB8-GRID-HOME-DRAWS`, sent to coordinator); full cohort exit 2 retained, with no junction failure. **OB8-RENDER-CPU (G908, after Jake QA):** engine submission/ownership, uniform and static-matrix bookkeeping; expected 0.07–0.20 ms/frame at 4× (about 1–3.5 µs/draw), estimated from sampled exclusive costs, unproven; no engine/game cut landed. Exact numbers and source limits below | Codex (Sim lane) + Opus 0.5 d fixes | 1.5 | Every plot meets bars 12–15 on the Simulator; the junctions hold; nothing crashes |
| OB9 | **done (2026-11-03, `48b08331c0`; G872, sp-o3).** **Title hero re-shoot board.** Board art/main-menu-hero/round-8-ob9/board.jpg: A shipped, B the same G625 camera re-shot on `c8b9be9d42`, C 200 m forward. B ships: Frostline, Bayou, Coral and Night Market built where A showed holograms. Jake's pick overrides. After G972 and OB2–OB6, the 5 × 5 hero shows three of these plots, plus Nine Dragon at (1,-1). One labelled A / B / C board of re-shoots of the same NW-b framing | Opus | 0.5 | Board sent. Jake's pick ships, or the current hero stays |
| OB10 | **Night Market catch-up (G980)**: after OB2–OB6, bring the Night Market to the same tile-kit bar (landmark, dressing density, audio, phone perf). **In flight (2026-11-03, sp-o3).** R1, the gate (art/grid/round-77-night-market-ob10): the coarse gate is drawn in its landmark graph (`coarseLandmark: "lit"`), so it reads red and gold from the road entry instead of dark; near 12k → 18k triangles; road entry 116 draws (`a8f1f940c7`). R2, density: L0 max 17,886 → 14,852 triangles, mean 8,910; wire 7.94 MB. Top-down 624k triangles, mostly the neighbouring cells; road 282k, plaza 495k (`8925472ace`). Look loop R1 (G983): warm dusk ground on round 49's floor colour, a lavender-to-peach sky and warmer lantern pools. Loop R2: fog 600-1800 m, so the aerials read clear. Final board art/grid/round-77-night-market-ob10/board-final.jpg (round 49 · before · now). Open: the gate's coral (its landmark graph is shared), the plaza's scale. Audio goes with OB7 | Opus + Codex | — | Same bar as OB2 |
| — | Jake plays the plots on live | Jake | — | His word |

G972 qualification: all 25 cells and origins are identical in public and Developer modes; Nine occupies (1,-1). The four selected collider changes earned the maintained 75-route walk: 75/75 passed, zero stuck or bounds failures. Public Nine also passed the real native reserve/readiness fence, refused premature save, frozen-away ticks and durable restored continuation. The first raw Node caller refusal was retained; its corrected caller reads the ordinary current product, with every original assertion kept. Focused typed lint passed. Root types passed after the Scene correction; the final recheck then stopped at the unrelated `merge-held-parts.test.ts` attribute/nullability frontier (routed to its owner). Self-applied G872 collider and fixture rulings; no walk waiver.

Order: OB1 runs at any time, independent of the art. Then prerequisites OP1 ∥ OP2 → OP3 → OP4 → OB2 (the pilot) →
OB3 ∥ OB4 ∥ OB5 → OB6 on the first free Opus lane. OB7 runs alongside: the pilot's audio first, then the four. Then
OB8 → OB9.

### Why Lantern Bayou is the pilot

It has the most kit reuse: OP1's lantern and rope, the strings, boardwalk bridges, canal water and the Hunyuan trees.
So the pilot's time goes into what is new for every plot: the three-way "better" board, the palette row from the
2 × 2 board, the mirrored tile layout, the life check, the audio rows, far stand-ins re-authored from the kit, and holding the landmark for the whole cell. It
is in the hero image. Its main risk, reading as orange like Night Market, is what the three-way board checks by eye.

The alternatives are Ember Forge (the most distinct, and it tests the lava kind and the Nine junction early) and
Frostline Peaks (the hardest, and the most central in the hero).

### Lanes and size

- **Opus** does all visual work (G848): landmarks, families, the final layout, look, far, life and boards. Up to three
  lanes, on the G960 / G967 ladder.
  - The pilot can run on two Opus lanes, one on the landmark, one on the theme tiles and look. The third lane takes
    OP1, then starts Frostline's landmark mockups.
- **Codex** does the non-visual work: OB1, layout stubs, template additions, audio generation and wiring, capture runs,
  readings and tiling reports. Pixel-identical perf cuts may land on Codex (G958). Two lanes are enough: Codex work is
  about half of Opus's.
- **Totals (G978 re-scope):** Opus ≈ 9.5 lane-days (was ≈ 20; +0.75 for OP1). Codex ≈ 7 lane-days (was ≈ 9.5; +2
  for OP2–OP4). The four new plots (§8) add ≈ 6 Opus + 2 Codex.
- **Calendar with 3 Opus lanes:**
  - prerequisites about 1.5 days;
  - the pilot about 1–1.5 days;
  - wave 2 about 2–2.5 days (6.5 Opus lane-days on 3 lanes);
  - the end about 1 day.
  - That is **about 6 days if three Opus lanes hold** (was 10–11). Plan on **1–1.5 weeks** with usage step-downs and
    the fixes Jake's plays ask for; the four new plots add about 2 days on 3 lanes.
  - For comparison, Night Market took 5 calendar days and about 10 Opus lane-days for one plot, while building the
    tooling.

## 6. The perf budget per cell, near and far (G948-style tiles)

**Tiles.** Each plot is the 8 × 8 lattice of 62.5 m tiles. Following G948, a tile is a unit of bake and detail, not of
loading:

- **Dressing tiles** load by the device ring (5 × 5 plus NF6's slack). Open plots are wide and flat, so the ring fits
  them, unlike Nine's column.
- **The landmark is the plot's "Nine column".** It is tall (Frostline about 70 m, cypress about 40 m, furnace and tower
  about 35 m, coral arch about 25 m) and seen from every road. It and its tile are **held for the whole cell**, with
  near or coarse picked per tile by screen-space error rather than by the ring. Every tile driver must read the
  product's ring, the NT1 lesson.
- **Every tile bakes L0 (near) and an L1 coarse shell from one source.** The shell is the full look as HLOD (G934),
  ≤ 10k triangles, ≤ 2 draws.
- **The far proxy** is ≤ 8k triangles, 1 draw, re-authored from the real kit so the 100 m and neighbour views keep the
  silhouette (the G949 far copy).
- **Each build reports** per-tile MB, triangles, draws and height (G950).

**Inside the plot** (phone tier, 2×):

| Budget | Value |
|---|---|
| Draws | ≤ 130; hard cap 150 (G937). Static tiles bake to batches per material family (G934); repeats are instanced. No facade multi-draw anywhere (E271) |
| Render CPU | ≤ 30 µs per draw |
| L0 tile | ≤ 15k triangles, ≤ 0.3 MB, ≤ 3 draws after batching (format caps: 4 MB resident, 40k triangles, 8 draws) |
| Landmark | ≤ 25k near, ≤ 6k coarse, ≤ 2.5k far; ≤ 0.8 MB |
| Material families | ≤ 8 classic GLSL, warmed before the road-entry handover |
| Triangles in view | ≤ 600k |
| Memory | ≤ 1.0 GB playing as the aim; 1.2 GB per shard hard; 1.8 GB loading |
| Frame | Sim 30 fps floor, p95 ≤ 34 ms; ≤ Night Market's frame cost at matched poses |
| Download | ≤ 2.5 MB of GLB plus ≤ 3 MB of streamed audio. The shared kit is paid once |

**From a neighbour.** A built plot seen from the next cell draws only L1 shells inside the ring and its far proxy
beyond: **≤ 12 draws and ≤ 60k triangles per neighbouring plot**. The grid page has no total cap (G556), only "don't
crash", so OB8 reads the two junctions where these plots stack up:

- **J1**, the corner of Nine Dragon (1,-1), Ember Forge (2,-1), Nalati (1,0) and Mosslight (2,0). It is the heaviest:
  Nine is the costliest shard, and G972 puts it there for everyone.
- **J2**, the corner of Frostline (-1,-1), Lantern Bayou (-2,-1), Coral Drift (-2,-2) and the new plot at (-1,-2).

At each junction the done-when is a 30 fps floor on the Simulator, no crash, and draws within 150.

## 7. Night Market lessons this plan builds in

- The pilot boxes were "trash fire", so every plot starts at remaster quality.
- The far proxy showed at eye height while tiles streamed. The road-entry clip must show near tiles, not stand-ins.
- The look misses (D111) and the invisible life (D112) were found only at the plan's end. Here the by-eye look check
  against the 2 × 2 board and the life check are done-whens on every row (G978 dropped the ΔE00 gate).
- Floating lanterns (G827): every emitter hangs on something.
- Image-to-3D people (G755): none.
- Shaders compiled on arrival (RM12): a family cap and warmed programs.

## 8. The new unique plots follow the same template

G970 / G973 replace the remaining duplicate cells: Night Market (-1,-2), Frostline (-2,2), Ember Forge (-2,0) and
Mosslight (-2,1). The replacements are four new plots plus a spare, designed by the sibling plan
`docs/plans/open-plots/new-unique-plots-mini-plan.md` (ask E522). Once Jake approves their themes and mockups, each one
runs this plan's bar (§2), pipeline (§4) and per-cell budget (§6) as one more row of the OB2 shape. They start after
the pilot, at about 1.5 Opus + 0.5 Codex lane-days each (G978; was 3.5 + 1–1.5), reusing the shared families this
plan builds (pines, palms, lava, lagoon, ruin stone). G977 made Jungle Ziggurat the fourth (Mushroom Hollow dropped);
their look targets are the round-75 2 × 2 boards (`art/grid/round-75-new-plot-palettes/`, G978). Showcase Template stays for later (G973). The other open plots stay in OPEN-PLOTS, which
can adopt this bar when it starts.

## 9. Questions for Jake

Answered 11-02 (G975, G976); kept as asked. Question 1's "two secondary landmarks each" is superseded by G978.

One panel of four, asked with the question tool. Option 1 is always "Skip for now". A skipped question stays
`needs pick`, and the lanes build the recommended answer (G872).

1. **Themes.**
   - 1 Skip for now.
   - **2 Confirm the five as written: the round-62 looks, the signature landmarks, and two secondary landmarks each
     (rec).**
   - 3 A new mockup round per plot before building.
   - 4 Change one theme (say which).

   *Why:* you approved round 62 (G714). One landmark board per plot keeps the morning batch small.
2. **Pilot.**
   - 1 Skip for now.
   - **2 Lantern Bayou (rec).**
   - 3 Ember Forge.
   - 4 Frostline Peaks.

   *Why:* it has the most kit reuse, so the pilot proves the new bar (the "better than Night Market" board, the ΔE
   gate, life, audio) instead of new families. It is in the hero image.
3. **When.**
   - 1 Skip for now.
   - **2 OB1 (one grid, Nine at (1,-1)) now on the first free Codex lane; the five plots start when SHARD-PLATFORM
     archives (rec).**
   - 3 Everything after the archive.
   - 4 Pull the whole plan forward now, Opus included.

   *Why:* OB1 is a small data change that you have already ruled (G972). The plots need Opus lanes, and those are on
   the fps close-out tonight (G967).
4. **Night Market catch-up.**
   - 1 Skip for now.
   - **2 After the five, one row brings Night Market to this bar: audio, its ΔE misses and the OP1 lanterns (rec).**
   - 3 Leave Night Market as it is.
   - 4 Do it first, before the pilot.

   *Why:* the five will out-class it. One row (Opus 1 d, Codex 0.5 d) keeps the reference plot from becoming the
   worst on the grid.

### OB2 reusable Codex additions

G979 track 2, sp-x1, atop X2’s OP2 `fc404c48b1`: one authoring CLI
(`scripts/open-plots/ob2.mjs`) and typed API prepare the pilot’s audio
rows, measure the road-entry clip, compose its comparison board and
export the existing verified per-tile report. See
[the tool guide](../../../scripts/open-plots/OB2.md).

**2026-11-03: Codex tooling complete, with live captures and native walks.**

- `ee85143593`: the five planned audio rosters feed both the template's
  `<idea>.audio.json` requests and `ob2.mjs audio --plot=<idea>`. Positions
  stay null until OB7 places them; real assets, credits, loop metadata and
  native playback binding remain OB7's work.
- `a19c4cae2f`: `life-capture.mjs` captures eleven lossless 402 × 874 PNGs
  from one live fixed road-entry camera and prints PASS/FAIL plus each
  500 ms interval's changed-pixel count. Actual Ember at `05f1661521`:
  5.005 s, **FAIL**, one changing region. Furnace sparks: zero pixels in
  all ten intervals; road lamps: 1,750–2,152 pixels per interval. This
  detects the still-open bar-7 gap; it does not infer system identity.
- `8bc2037c69`: `comparison.mjs --plot=<idea>` captures the four matched
  plot-local phone cameras for NOW and Night Market and makes the labelled
  MOCKUP / PLOT NOW / NIGHT MARKET NOW JPEG. Actual Ember board viewed:
  1206 × 2622, **283,816 B**, same build, live clock, 2× render scale.
- `10fe65fdb1`: `tiling.mjs --plot=all` exports five verified G950 reports,
  80 tiles each, with per-tile MB, triangles, draws and height plus index
  hashes. CURRENT admission remains strict; stale products refuse before
  batch publication. Whole-level totals are not live-view memory/draws.
- `d74cab106c`: maintained routes for Frostline, Bayou, Ember, Mosslight
  and Coral run through `physics-baseline.mjs --no-build --mode=walk`
  with `--shard=open-plot-<idea>`. All five native residents complete their
  south entry, bridge approaches, plaza perimeter and landmark-base route
  with **0 stuck / 0 bounds failures**. No geometry or colliders changed.

Focused controls: 10 OB2 cases, 18 template cases and 6 native CLI cases
pass, plus all five actual walk routes. Root/scripts types and named fast
lint pass. Live captures used a muted browser-lane-owned iPhone 16 Pro
profile, closed after capture. The pilot's art, visible-life, native audio
playback and phone-performance acceptance remain open; tooling completion
is not full OB2 completion. No visual fix is part of these commits.


### OB0: public five-card source landing (2026-11-03, G984)

Frostline Peaks, Lantern Bayou, Ember Forge, Mosslight Ruins and Coral Drift
use their existing thumbnail/portrait/landscape file references and the
existing card layout. Each output overrides `shardSelect: true` and the
existing `earlyAccess` status, which enables the ordinary public ENTER WORLD
button. Night Market remains experimental; all other plot cards retain
their existing visibility. There is no new UI, text, grid entry or asset.

The original selector catalogue control and five real public-mode deck
controls pin the cards, native shardfile paths and each ENTER WORLD callback
to its own standalone plot. Focused selector/config suites pass; root types
and typed lint pass. An initial experimental-status probe correctly refused
all five public entries as Coming soon; the shipped source uses the existing
public early-access path without changing that restriction.

The exact source audit keeps every non-manifest plot field, geometry/bake
input and existing image pointer unchanged, including X8's four loose NU3
rows. `outputs.json` is in the normal author-module hash: this metadata edit
can invalidate the complete program/map/source cache namespace even though
geometry inputs are identical. No product-key bypass or freshness waiver is
introduced. No geometry build, payload or collider change is claimed.

**Remaining OB0 acceptance:** enter all five from SHARD SELECT on the queued
landed-SHA WebKit iPhone 16 Pro turn, with Developer off. Unit/source
qualification is not native-entry or whole-OB0 completion. Reuse a joined
immutable HEAD preview where possible; preserve active native cohorts.


### OB0: authored boot-inventory fix (2026-11-03)

The first public-card landing missed the authored boot-inventory binding.
The exact normal `bake-packs --check` refused with `Level boot has no
authored asset sources`; a normal Mosslight product build passed. Thus the
newly public level lacked its bootstrap declaration, rather than its real
product/world assets.

All five now bind the existing Night Market native-product files/sources
JSON through their own manifest overrides. This established native contract
has no predecessor eager public-asset pack: `manifestFromShardfile` and
`compiledPageBoot` consume the admitted product's world assets. Five ordinary
product builds passed, each with real files and no legacy runtime. No new
empty inventory, invented asset URL, fallback, engine guard or cache policy
is introduced. G872 exact native-contract classification is self-applied.

The public-card tests now exercise the actual authored boot-source resolver
in both tiers/texture modes, the real pack-fetch list and all five ordinary
ENTER WORLD callbacks. The original missing-sources guard remains negative.
Real generated asset tables are installed through the maintained fixture.
The three focused suites pass (26 cases); root types and typed lint pass.
Normal pack publication passes, followed by its independent strict check.
An earlier strict check reached the existing stale-publication guard after
passing source admission; normal publication refreshed it without relaxing
either guard. All other plot metadata and bake fields stay exact, including
X8's four appended NU3 rows. The five real WebKit entries remain queued.


### OB0: five public WebKit entries qualified (2026-11-03)

All five public SHARD SELECT cards entered their own standalone worlds on
the immutable `53dd955063aca925db357a583c4101db03720aec` preview, build
`53dd955-mw0atk0y`. One real WebKit browser used serial iPhone 16 Pro
402 × 874 / DPR 2 contexts with Developer off. The actual carousel card and
ENTER WORLD button were used; every case reached native `play`, entered
unpaused HUD, frameGate, a finite live player and `grid: null`.

| Plot | Additional real gameplay frames | Fatal / page / console faults | Result |
|---|---:|---:|---|
| Frostline Peaks | 12 | 0 | PASS |
| Lantern Bayou | 12 | 0 | PASS |
| Ember Forge | 13 | 0 | PASS |
| Mosslight Ruins | 12 | 0 | PASS |
| Coral Drift | 13 | 0 | PASS |

Every initial/final version guard retained the same exact build. Fifteen
lossless 804 × 1748 title/card/gameplay captures passed the unchanged native
image guard; all five gameplay images were viewed. The caller reused the
maintained boot observations/readiness guards with WebKit's supported PNG
transport, never a fabricated world, synthetic clock or screenshot scene.
Two earlier caller refusals (Chromium-only CDP transport and selected-card
text assertion) happened before any ENTER WORLD tap; their raw evidence is
retained separately and is not called a game failure or native pass.

Actual reading: `tmp/sp-x1-ob0/webkit-entry/reading.json`; full per-case
observations and captures are beside it. The cohort exited 0, every browser
context closed, and the ordinary joined 4407 preview borrow was released
with exit 0. No extra app build, physics change, physical-phone, CI timing
or whole open-plot art/completion claim follows. This meets OB0 only.

### OB8 readings, 2026-11-03

**Open, sp-x1.** The first two final looks are Mosslight `dacd146b65` and
Ember `dd271faebc`. One joined immutable HEAD preview, source
`fd7f01690e2b91900a78255c7d41bf1e403e43d4`, supplies this batch. Its initial
predecessor `82c361bc78` refused Coral's 5,676,044 B phone wire against
5,676,036 B; coordinator-approved budget-only `fd7f01690e` admits the exact
+8 B from shared graph changes. No look, Pine or Nine source changed.

Chromium: Metal M5 Max, phone CSS 402 × 874, canvas 804 × 1748, live clock,
2× render scale, boot 1× CPU then measurement 4× CPU, 120 paired drawn
frames at each ordinary player pose. Road: `(0,1.7,-241,pi,0)`; plaza:
`(0,1.7,-62,pi,0)`, angles in radians. These are live player-camera readings,
not the OP4 free-camera hero images. All six windows have p95 **33.4 ms**,
p5 about **29.94 fps**, and **0 sampled intervals >100 ms**.

| Plot / pose | Maximum draws | Triangles (median) | Mean / worst render CPU µs per draw |
|---|---:|---:|---:|
| Mosslight road | 55 | 124,718 | 44.015 / 85.455 |
| Mosslight plaza | 61 | 174,439 | 32.869 / 50.820 |
| Ember road | 53 | 103,542 | 42.437 / 64.151 |
| Ember plaza | 58 | 167,399 | 37.658 / 55.172 |
| Night Market road (control) | 54 | 147,182 | 44.043 / 62.963 |
| Night Market plaza (control) | 59 | 305,256 | 37.641 / 50.847 |

The 30 µs-per-draw target misses on Night Market too. Per wildshard-new's
matched-control ruling, this is the common baseline at this setting;
`OB8-MOSSLIGHT-CPU` and `OB8-EMBER-CPU` are not plot-specific misses and are
not routed to Opus. The raw target and numbers stay visible. Both new
plots meet ≤130 observed draws, ≤600k reported triangles and the matched
Night Market frame-cost test at these poses. The reader retains median
triangles, not an all-frame maximum. Chromium is diagnostic; Simulator
acceptance remains separate.

Independent Chromium spawn memory: three settled samples, no forced GC,
real renderer plus GPU process footprints. Mosslight peaks at **704 MiB
(about 738.2 MB decimal)**; Ember **692 MiB (about 725.6 MB)**, both under
the 1.0 GB aim. Source fields are rounded MiB. All six samples have 0 page
errors. These are spawn samples, not a loading or every-pose memory proof.

Walk: the normal `physics-baseline.mjs --no-build --mode=walk` correctly
refused products invalidated by loose peer edits. No guard was bypassed.
`open-plots/walk.mjs` instead reads the exact pinned maintained route and
runs `walkLeg` on that preview's actual resident with real fixed steps.
Mosslight completes all entry, bridge-approach, plaza-perimeter and
landmark-base waypoints in 164.1 s: **0 stuck / 0 bounds failures**.
Ember completes the same route in 164.4 s: **0 stuck / 0 bounds failures**.

Tooling: `074102c745` adds validated fixed standing inputs to the maintained
frame reader; `376bf851c0` adds the same-preview live walk and accurate
native quiet metadata. The native reader recognises standalone entered,
unpaused, frame-ready play. Focused controls, scripts types and named lint
pass. Raw readings stay in `tmp/sp-x1-ob8/`; the numbers above are durable.

Remaining after the Simulator cohorts below: Coral Chromium/walk;
final-board Bayou and Frostline; then the two junctions, at ≤150 draws
and a 30 fps Simulator floor. Each miss goes to the coordinator as a named
request for its owning lane. Nothing here qualifies all of OB8.


**Coral official Simulator fallback, accepted by wildshard-new.** Same
`fd7f01690e` source and ordinary player poses, one 43.2 s cohort through the
maintained reader, `scripts/sim-lane.sh` and `scripts/sim-quiet.py`.
Safari's actual viewport is 402 × 714 with 804 × 1428 render pixels, 2×;
no capture clock or frame limiter bypass. This is portrait Safari
regression evidence, not a full-height home-screen PWA or physical phone.

| Pose | Maximum draws | Triangles (median) | Median fps | p5 fps | p95 / worst ms |
|---|---:|---:|---:|---:|---:|
| Coral spawn | 67 | 200,952 | 30.303 | 29.412 | 34 / 34 |
| Coral road | 63 | 117,859 | 30.303 | 29.412 | 34 / 34 |
| Coral plaza | 71 | 217,645 | 30.303 | 29.412 | 34 / 34 |

Native conservative playing envelope **236,404,512 B** (236.4 MB), loading
**566,546,888 B** (566.5 MB): kernel WebContent interval highs plus the
**26,931,952 B** GPU allocation peak, never GPU process footprint added
again. Coverage: **282 native samples, 218 playing / 64 loading**, 46 GPU
reads. One Inspector-closed sample during navigation is retained; phase
coverage completes. There are **0 page/runtime faults**, no context loss,
no crash and 0 sampled intervals over 100 ms. Coral meets the measured
Simulator draw/frame/memory/triangle bars at these poses. Its final-look
Chromium/control and walk remain open; this does not complete all OB8.

The fallback started while other lanes had finite work in flight. sp-o2's
capture refused at its Bayou D1 boundary and closed; he confirmed the
Simulator reading was clean. All concurrency context stays visible. The
reader released quiet and shut down the Simulator; the first preview use
was released immediately. The coordinator then requested the Mosslight +
Ember pair below, using per-shard native files/results (`9afed8e11b`).
Bayou, Frostline and the junctions stay pending until their final boards.


**Mosslight + Ember official Simulator pair: passed, one 76.2 s window.**
Both final looks ran back to back through one `frame-floor.mjs` worker,
one `sim-lane.sh` lease and one official `sim-quiet.py` window. Each load
used a cold Safari process and independently retained native files/results.
Same source `fd7f01690e`, player poses, 402 × 714 / 804 × 1428 and 2× profile
as Coral; 120 actual drawn frames per pose, without forced GC or clock
substitution. All rows have median **30.303 fps**, p5 **29.412 fps** and
p95 **34 ms**.

| Plot / pose | Maximum draws | Triangles (median) | Worst frame ms |
|---|---:|---:|---:|
| Mosslight spawn | 60 | 168,362 | 34 |
| Mosslight road | 59 | 124,990 | 35 |
| Mosslight plaza | 65 | 177,126 | 35 |
| Ember spawn | 57 | 153,408 | 35 |
| Ember road | 60 | 105,098 | 34 |
| Ember plaza | 64 | 169,437 | 34 |

| Plot | Playing envelope B | Loading envelope B | GPU ledger peak B | Native samples: playing / loading |
|---|---:|---:|---:|---:|
| Mosslight | 237,234,230 | 908,458,910 | 28,482,398 | 219 / 64 |
| Ember | 238,477,762 | 903,443,562 | 24,712,402 | 215 / 42 |

These are conservative kernel-WebContent-plus-GPU-ledger envelopes,
about **237.2 / 238.5 MB playing** and **908.5 / 903.4 MB loading**. Both
meet the 1.0 GB playing aim and 1.8 GB loading limit. GPU reads: 47 / 46;
each retains one Inspector-closed navigation sample, with complete phase
coverage. **0 page/runtime faults, context losses, crashes or sampled
intervals over 100 ms.** The measured draw/frame/memory/triangle bars pass;
the full maintained live walks also pass (above). No plot miss is routed.
The finite Bayou score batch was already running when this window was
requested; its natural boundary was preserved and no new model load began
during quiet.

The attempted newer HEAD `9dcf3e5f11` preview refused all six built open
plots with `World GLB material LandmarkCoarse is unmapped or its output ID
is not admitted`. Named request `OB8-COARSE-ADMISSION` went to the
coordinator; sp-o3 identified `a8f1f940c7` as the cause and fixed forward in
**`17e15e8d42`**, pushed, with a successful HEAD preview. No look fix was
made by sp-x1. The pair reused the original accepted source so this batch
keeps its matched-control source; it does not claim measurements of that
newer fix. Only one preview of a source was active for this lane at a time.

Quiet was released, the Simulator shut down (0 / 1 booted), and the second
preview use released immediately after the pair. All measurement browsers
are closed. **OB8 remains open:** Coral Chromium and full walk; Bayou and
Frostline after final-board SHAs; J1 and J2 after those looks. Their verified
lattice pitch is 562.5 m: J1 `(843.75, -281.25)`, Nine / Ember / Nalati /
Mosslight; J2 `(-843.75, -843.75)`, Frostline / Bayou / Coral / Fossil
Badlands. No junction result is implied. Pine and Nine source stay untouched.


### OB8 render CPU attribution and Coral Chromium

One HEAD preview of **`25f6429733`**, containing the admitted material fix
`17e15e8d42`, supplies both this profile and Coral. Ordinary road/plaza
player poses, Metal M5 Max, phone 402 × 874 / 804 × 1748, 2×, live clock,
120 drawn frames per pose. The maintained `frame-floor.mjs` control uses
its original Chromium channel and a **250 µs CDP sampling interval**.
Native completed-frame counters remain paired. Mean Night Market render
CPU is **44.325 / 36.737 µs per draw**, consistent with the first control;
58 / 59 draws, p95 frame interval 33.4 ms. The strict 30 µs CPU target
still misses, as retained by the coordinator's common-baseline ruling.

Private source maps resolve sampled program locations, then the matching
source AST restores original function names. The table partitions samples
under the actual render stack, counts each sample once, and excludes idle,
physics and update-only work. These are **sampled ms per drawn frame at
4×**, not GPU time or measured savings. Inclusive stack totals overlap and
are not added to the partition.

| Cost | Road ms/frame | Plaza ms/frame | Source owner (matching Three 0.186.0) |
|---|---:|---:|---|
| Scene traversal/culling | 0.391 | 0.357 | `node_modules/three/src/renderers/WebGLRenderer.js:1860`, `projectObject` (mapped build line 17897) |
| Vertex/buffer binding setup | 0.366 | 0.236 | `node_modules/three/src/renderers/webgl/WebGLBindingStates.js:13`, `setup`; native `bindVertexArray` self 0.105 / 0.047 |
| Uniform cache/flatten/upload path | 0.369 | 0.380 | `node_modules/three/src/renderers/webgl/WebGLUniforms.js:74` and `:329`, `flatten` / `setValueM4`; engine `src/engine/render/uniformCaches.ts:26` |
| Program selection excluding the uniform path | 0.240 | 0.089 | `node_modules/three/src/renderers/WebGLRenderer.js:2370`, `setProgram` (mapped build line 18407) |
| Object/camera matrix work | 0.124 | 0.088 | `node_modules/three/src/core/Object3D.js:1176`, `updateMatrixWorld`; `node_modules/three/src/math/Matrix4.js:562`, `multiplyMatrices`; `src/engine/render/staticMatrices.ts:68` |
| GL state/material changes | 0.118 | 0.062 | `node_modules/three/src/renderers/webgl/WebGLState.js:754`, `setMaterial`; `:566`, `useProgram`; binding/depth/texture state |
| Remaining render submission, shadows and bookkeeping | 0.933 | 0.816 | Includes `src/engine/render/drawHooks.ts:54` and `src/engine/render/uploadOwnership.ts:131` |
| Total sampled render stack | 2.541 | 2.029 | Compare paired native mean render time 2.571 / 2.167 ms |

A separate diagnostic window, with its hooks restored before sampling,
observes **186.1 / 128.3 actual uniform GL calls per frame**, **34 / 14
useProgram calls**, **13 / 12 distinct programs**, and **34 / 17 material
switches** at road/plaza. It uses the existing `drawFrames` census; it is
not acceptance timing. It ran in the phone-device headless-shell context,
whose own baseline was slower, so those timing values are excluded from
the matched control above. The original channel's CPU profile is the
attribution authority. First symbol decoding hit an unmapped Rapier WASM
frame; that raw capture is retained, not called a game failure. Non-JS
frames are subsequently kept separate rather than assigned JS source.

**No runtime cut landed.** The generated kit already batches by material;
ring residents already use the static-matrix hold. Scene traversal, VAO
binding, program selection, uniform caching and ownership observation are
implemented in engine/game/Three code. No source-only data/generator edit
was proved both pixel-identical and cheaper. Removing motion, changing
material families or altering tile/LOD grouping would not establish that
proof. G908 keeps engine/game and Pine/Nine untouched.

The **single follow-up line is on OB8 above: `OB8-RENDER-CPU`**. The five
sampled engine bookkeeping files have exclusive self totals **0.396 /
0.269 ms/frame**: draw hooks, GPU labels, upload ownership, uniform caches,
static-matrix checks. An expected 25–50% reduction is **0.07–0.20 ms/frame
at 4×**, about **1–3.5 µs/draw**. This is a provisional sizing estimate,
not a demonstrated saving, and cannot alone promise the 30 µs target.
Detailed entry points are `drawHooks.ts:54` / `:136`, `gpuLabels.ts:258` /
`:422`, `uploadOwnership.ts:131`, `uniformCaches.ts:98` and
`staticMatrices.ts:40` / `:68`. Implement only after Jake's QA releases
G908; preserve pixels, upload/ownership lifecycle and mutable transforms.

**Coral Chromium on the same `25f6429733` preview:** Metal, ordinary fixed
poses, 1× boot then an acknowledged 4× measurement fence, 120 paired drawn
frames each, no profiler or GL wrappers. Spawn / road / plaza max draws
**59 / 59 / 66**; median triangles **177,440 / 115,023 / 209,317**. All
median **30.03 fps**, p95 **33.4 ms**, p5 about **29.94 fps**, 0 sampled
intervals over 100 ms. Mean render CPU **37.444 / 38.729 / 39.508 µs per
draw**; road/plaza worst **67.797 / 57.576**. The absolute CPU target
misses at the shared-control scale; no plot-specific CPU ask is routed.

Coral work p95 is **4.3 / 4.7 ms** road/plaza; the profiled Night Market
control is **5.0 / 3.8 ms**. Mean render is **2.285 / 2.608 ms** versus
**2.571 / 2.167 ms**. The plaza's CPU work is higher in this diagnostic
comparison, while observed frame cadence is equal; a profiled control is
not an uninstrumented CPU-work acceptance comparison. These figures stay
visible rather than treating identical cadence as identical work.

Independent spawn process-memory samples peak at **708 MiB**, about
**742.4 MB decimal** (rounded source fields), with 0 page errors. This is
renderer plus GPU process footprint, separate from the accepted Simulator
native-plus-ledger envelope. The exact-source full Coral walk completes in **164.1 s**, with
**0 stuck / 0 bounds failures**, every maintained waypoint and the final
endpoint verified on its actual resident. No collision/source change was made.


### OB8 final Frostline, board b07a842976

The final labelled board and its R2–R5 gap record were read before this
measurement. One HEAD preview **`0c3e3ca16b`** contains that final look.
All standing poses and live 2× phone contracts remain as above.

| Surface / pose | Max draws | Triangles (median) | Median fps | p95 / worst ms | Mean / max render µs per draw |
|---|---:|---:|---:|---:|---:|
| Chromium spawn | 50 | 154,038 | 30.03 | 33.4 / — | 42.100 / 110.000 |
| Chromium road | 52 | 105,957 | 30.03 | 33.4 / — | 37.885 / 59.615 |
| Chromium plaza | 63 | 183,844 | 30.03 | 33.4 / — | 28.677 / 46.032 |
| Simulator spawn | 58 | 168,295 | 30.303 | 34 / 34 | — |
| Simulator road | 56 | 106,749 | 30.303 | 34 / 34 | — |
| Simulator plaza | 65 | 184,803 | 30.303 | 34 / 34 | — |

Chromium: 120 paired frames/pose at 4× Metal, boot at 1× and an acknowledged
measurement fence; no profiler. p5 about 29.94 fps; 0 intervals over 100 ms.
The absolute CPU-per-draw target stays a shared-control follow-up, not an
Opus look change. Spawn process-memory peak **687 MiB**, about **720.4 MB
decimal**, with 0 page errors (rounded source MiB fields).

The full maintained live walk completes in **164.4 s**, every
waypoint and endpoint verified: **0 stuck / 0 bounds failures**. No collider
edit or per-waypoint teleport. The official Simulator cohort completes in
**45.2 s**, exit 0, one G670 window. p5 **29.412 fps**; native playing
**248,716,560 B**, loading **1,030,303,816 B**, including GPU ledger peak
**32,739,312 B**. Native phase coverage **221 playing / 66 loading** (287
samples), 47 GPU reads; one navigation Inspector gap retained. No page or
runtime fault, context loss, crash or sampled interval over 100 ms.

Frostline meets the measured draw/frame/memory/triangle bars. Quiet clears
and the Simulator shuts down immediately. The same preview is reused for
Bayou and the two newly unblocked junctions; it is not rebuilt for them.

Bayou's final board **`e7266ada94`** was read (look source `02f325dade`).
Its plot-specific layout, template, generator and landmark inputs are
unchanged through `0c3e3ca16b`. sp-o2's ordinary checked-product native walk
at `e7266ada94` passed its one maintained leg with 0 stuck / bounds
failures. The actual JSON report
`tmp/physics/native-walk-2026-11-03T09-12-31.464Z-42110.json` was independently
read: success, 1 passed, 0 failed, the Bayou route present. This is a
companion native-product proof, not claimed as a browser-preview walk; no
identical walk is repeated without a new collider change.

The fixed-pose reader now also retains actual grid pitch, assembled cells
and residency **after** each timed sample. Junction identity can therefore
be checked from the measured page itself rather than inferred from the
input file. This adds no scene walk, gameplay change or frame observer;
focused controls, scripts types and named lint pass.


### OB8 final Bayou and junctions J1/J2

Final Bayou board **`e7266ada94`**, source look `02f325dade`, measured on
the **same `0c3e3ca16b` HEAD preview as final Frostline**. Its own template,
layout, generator and landmark inputs have no diff from the final look.
The board and its open art gaps were read; no art change follows from this
measurement. The maintained native walk is independently verified above.

| Bayou surface / pose | Maximum draws | Triangles (median) | Median fps | p95 / worst ms | Mean / max render µs per draw |
|---|---:|---:|---:|---:|---:|
| Chromium spawn | 60 | 184,911 | 30.03 | 33.4 / — | 69.597 / 93.333 |
| Chromium road | 60 | 114,798 | 30.03 | 33.4 / — | 41.736 / 63.333 |
| Chromium plaza | 67 | 217,602 | 30.03 | 33.4 / — | 36.194 / 50.746 |
| Simulator spawn | 68 | 200,779 | 30.303 | 34 / 34 | — |
| Simulator road | 64 | 117,506 | 30.303 | 34 / 34 | — |
| Simulator plaza | 72 | 218,346 | 30.303 | 34 / 34 | — |

Chromium uses the ordinary 4× Metal / 120 paired-frame protocol, 1× boot
and acknowledged 4× fence, phone 402 × 874 / 804 × 1748, live 2× render.
Road/plaza CPU-per-draw is at the Night Market control scale; the strict
30 µs target remains the one deferred engine follow-up. All sampled
intervals are ≤100 ms. Independent spawn process-memory peak **702 MiB**,
about **736.1 MB decimal**, 0 page errors (rounded source fields).

The official Simulator uses one **147.6 s** quiet window for Bayou then
the grid, separate cold Safari loads and per-shard native records. Bayou
p5 **29.412 fps**, native playing **242,264,100 B**, loading
**988,068,628 B**, including GPU ledger peak **26,417,948 B**. Native
coverage **215 playing / 42 loading** (257 samples), 46 GPU reads; one
navigation Inspector gap retained. No page/runtime error, context loss,
crash or sampled interval >100 ms. Bayou meets the measured acceptance.

The eight corner rows below use 120 actual drawn frames each at 2×,
402 × 714 Safari / 804 × 1428 render pixels. Position guards hold. Actual
post-sample grid snapshots, not just input coordinates, show pitch
**562.5 m**, current resident null, residents/pending empty and crossing
**settled** at every corner heading; the ring rendering remains live.

| Junction / heading (degrees) | Maximum draws | Triangles (median) | Median fps | p95 / worst ms |
|---|---:|---:|---:|---:|
| J1 −135 | 69 | 141,013 | 30.303 | 34 / 64 |
| J1 −45 | 62 | 128,632 | 30.303 | 34 / 36 |
| J1 +45 | 40 | 95,294 | 30.303 | 34 / 35 |
| J1 +135 | 54 | 227,920 | 30.303 | 34 / 34 |
| J2 −135 | 82 | 193,018 | 30.303 | 34 / 34 |
| J2 −45 | 36 | 45,551 | 30.303 | 34 / 34 |
| J2 +45 | 67 | 115,448 | 30.303 | 34 / 34 |
| J2 +135 | 74 | 122,983 | 30.303 | 34 / 34 |

J1's actual neighbours are Nine / Ember / Nalati / Mosslight at
`(843.75,-281.25)`. J2's are Frostline / Bayou / Coral / Fossil Badlands at
`(-843.75,-843.75)`. All eight requested rows pass the ≤150-draw and
30 fps-floor criteria, p5 **29.412 fps**, with no crash or interval >100 ms.
The full grid cohort's conservative envelope is **967,757,607 B playing**
and **1,171,382,135 B loading**, GPU peak **164,593,559 B**, native phase
coverage **650 playing / 80 loading**, 137 GPU reads and one retained
navigation gap. These are **page aggregate** figures, not an individual
plot's memory. G556 applies no global per-shard cap to that aggregate.

**The cohort is complete but exits 2, not green.** Its additional initial
home row is a real miss: **Driftwood home spawn 181 max draws against 150**,
**1,055,435 median triangles**, median **30.303 fps**, p95 **35 ms**, worst
**47 ms**. The actual home is Driftwood; that row still has six pending
neighbours (Far Reach, Nalati, Nine, Frostline, Pine and Sunscar). This row
is outside J1/J2; it is preserved and sent to the coordinator as named
request **`OB8-GRID-HOME-DRAWS`** for the home/Opus owner. No retry, waiver,
engine/game cut or look fix was made here. The requested junctions pass
independently; the raw whole-cohort verdict remains red.

All owned measurement browsers close; G670 quiet clears, the Simulator
shuts down (0 / 1 booted), and the joined preview use is released. Remaining
measurement work is **Coral again after its final board**, per the
coordinator: its look loop began after the provisional readings above.
The currently measured J2 source is explicit; no claim is made for future
Coral changes. The G908 CPU follow-up remains on OB8, with no engine/game
or Pine/Nine source change.


**Freshness after this batch:** `061178659d` lands Ember's coarse furnace
lighting after its accepted `fd7f01690e` reading and the `0c3e3ca16b` J1
reading. It adds an L1 landmark material/draw to four plaza tiles; the
Opus board reads road-entry draws 106 → 114. Old readings remain valid
only for their explicit source. **Ember and J1 require a refresh alongside
the final Coral batch**; J2's present source also remains explicit while
Coral's look loop continues. These are open items of OB8, not new ask
files. No look change or fresh acceptance is inferred from the old proof.


### OB8 current Ember/J1 refresh, source c8b9be9d42

One HEAD preview contains the Hunyuan furnace, coarse self-lighting and
visible stack embers (`c8b9be9d42`, board/README read). This supersedes the
old Ember source only for its newly measured rows; no older proof is
silently treated as current. No look or engine/game change by sp-x1.

| Ember surface / pose | Max draws | Triangles (median) | Median fps | p95 / worst ms | Mean / max render µs per draw |
|---|---:|---:|---:|---:|---:|
| Chromium spawn | 48 | 140,497 | 30.03 | 33.4 / 33.4 | 50.486 / 70.833 |
| Chromium road | 57 | 103,633 | 30.03 | 33.4 / 33.5 | 43.260 / 66.667 |
| Chromium plaza | 58 | 177,623 | 30.03 | 33.4 / 33.5 | 39.828 / 56.897 |
| Simulator spawn | 57 | 163,632 | 30.303 | 34 / 36 | — |
| Simulator road | 64 | 105,189 | 30.303 | 34 / 34 | — |
| Simulator plaza | 64 | 179,661 | 30.303 | 34 / 36 | — |

Standard 120 paired drawn-frame protocol, live clock, 2× phone scale;
Chromium 4× Metal, 1× boot then acknowledged measurement fence. Spawn
process-memory peak **697 MiB**, about **730.9 MB decimal**, 0 page errors.
Current furnace's full maintained live walk: **164.4 s, 0 stuck / 0 bounds
failures**, all waypoints and endpoint verified. No per-waypoint teleport.
Simulator native playing **203,288,972 B**, loading **1,144,144,972 B**,
GPU ledger peak **26,010,468 B**. Coverage **220 playing / 146 loading**,
47 GPU reads, one navigation Inspector gap retained. No page/runtime
error, context loss, crash or interval >100 ms. **Ember refresh accepted
by wildshard-new.** The common strict CPU target remains the G908 line.

| Current J1 heading | Max draws | Triangles (median) | Median fps | p95 / worst ms | Work p95 / callback p95 ms | Result |
|---|---:|---:|---:|---:|---:|---|
| −135 | 25 | 61,393 | 30.303 | 42 / 47 | 6 / 46 | FAIL; p5 23.810 fps <27 |
| −45 | 55 | 127,643 | 30.303 | 34 / 75 | 6 / 35 | PASS |
| +45 | 41 | 124,382 | 30.303 | 34 / 35 | 10 / 36 | PASS |
| +135 | 55 | 234,019 | 30.303 | 34 / 34 | 6 / 36 | PASS |

Actual post-sample snapshots verify pitch 562.5, the same four intended
neighbours, road current null, no pending/resident guest and crossing
settled. No page fault or crash. The **126.7 s cohort is complete but exits
2**: J1 −135 misses and the extra home row misses (117 max draws,
1,080,024 median triangles, p95 44 ms, worst 51 ms, work p95 11 ms). The
new home values supplement `OB8-GRID-HOME-DRAWS`, not a fresh ask file.
Grid aggregate native envelope **846,128,937 B playing / 1,366,537,889 B
loading**, GPU peak **166,467,001 B**, 371 playing / 264 loading samples,
75 GPU reads and two navigation Inspector gaps. No global shard cap is
applied to the grid aggregate.

**`OB8-J1-FRAME` is not routed to Opus yet.** A Frostline MiniMax batch was
already in flight at quiet notice and kept its natural boundary. With
6 ms work against 46 ms callbacks, the coordinator judges machine
contention more likely than the corner. The failing reading stays intact.
One explicitly authorized clean confirmation will measure **only J1 −135**
after `lsof ~/projects/localai/.model.lock` has no holders. Notify sp-x2
before entry so no next model load starts; preserve the current batch.
Pass closes the named request; a clean failure goes to the coordinator
with numbers for routing. No automatic retry or visual fix is authorized.

The first lock check still shows Python 96091, time 96097 and Python
96098 holding that file. sp-x2 confirmed it will send the actual wrapper
exit and keep the next model load out of the clean window. This is a
pending external boundary, not a held lane. All earlier browsers/Sim and
quiet are closed; the already served same-source preview is rejoined for
the single clean confirmation. Coral remains deferred until its final
board. Any further shared-plan edit uses an exact patch; the accidental
OB4 life status inclusion in `bfdc06d73c` was confirmed correct by its owner
and referenced in his `c8b9be9d42` landing, with nothing to fix.


### OB8 clean J1 −135 confirmation, source c8b9be9d42

**`OB8-J1-FRAME` closed by the coordinator's explicit pass rule.** The
single requested heading passes on the same production preview/source
`c8b9be9d42`; the earlier 42 ms p95 reading remains intact above and is
not routed to an Opus lane. No source or look change between the readings.

sp-x2's existing Frostline two-score wrapper exited naturally, code 0,
after 548.8 s. Before entry, `lsof` found **no holders** of
`~/projects/localai/.model.lock`; sp-x2 and the coordinator received the
start notice, and sp-x2 kept the next model load out until the end notice.
The official reader alone owned the bounded G670 quiet window through
`sim-lane` / `sim-quiet`: **51.648 s, complete, pass, exit 0**.

| Clean J1 heading | Max draws | Triangles (median) | Median / p5 fps | p95 / p99 / worst ms | Work / callback p95 ms |
|---|---:|---:|---:|---:|---:|
| −135 | 59 | 134,734 | 30.303 / 29.412 | 34 / 47 / 70 | 4 / 37 |

120 paired drawn frames, live game clock, phone tier at 2× render scale;
no CPU throttle or GL timing observer. Zero intervals >100 ms, page
errors, context losses or crashes. This clean result supports the
contention explanation; it does not assign a plot-specific CPU cause.
The actual post-sample snapshot verifies pitch **562.5**, road current
null, no resident guest, crossing settled, and the intended Nine Dragon /
Ember / Nalati / Mosslight corner. **Nalati and Nine remain pending in
that snapshot**; unlike the previous batch, it is not an empty-pending
reading. The fixed pose and source hash are retained in the raw report.

The unavoidable initial home row also passes this run: **139 max draws**,
**1,086,260 median triangles**, median **30.303 fps**, p95 **34 ms**, worst
**39 ms**, work p95 **8 ms**, callback p95 **36 ms**. Its five pending
neighbours remain explicit in the report. This supplements the earlier
181-draw `OB8-GRID-HOME-DRAWS` miss; it does not erase that reading or
close the coordinator-owned home follow-up.

Grid aggregate native envelope: **984,319,097 B playing / 1,410,372,665 B
loading**, GPU peak **161,297,209 B**, **148 playing / 182 loading** native
samples, 32 GPU reads and one navigation Inspector gap. G556 page-aggregate
qualification applies. The Simulator shut down, quiet cleared, sp-x2
received the end notice, and the joined preview use was released. The
preview remains available only for another lane's existing use.

**Remaining measurement boundary: Coral's final board.** No repeat of its
unfinished look loop is taken here. G908 engine/game CPU cuts and the
home miss remain the named follow-ups already recorded on OB8. Pine and
Nine source stays untouched.


### OB8 Mosslight/Frostline life refresh, source 03ad135a92

One preview of HEAD `03ad135a92` contains Mosslight's coarse tower
lighting (`acc0a955d6`) and the emerald motes / Frostline summit glints
(`3f18b9d190`). The road and life boards and their READMEs were read.
This refresh supersedes only the corresponding measured source rows;
older data remains intact. No look, engine or game edit by sp-x1.

| Chromium phone 4× Metal / pose | Max draws | Triangles (median) | Median fps | p95 / worst ms | Mean / max render µs per draw |
|---|---:|---:|---:|---:|---:|
| Mosslight spawn | 52 | 152,043 | 30.03 | 33.4 / 33.4 | 34.840 / 55.769 |
| Mosslight road | 59 | 124,910 | 30.03 | 33.4 / 33.4 | 32.486 / 55.932 |
| Mosslight plaza | 61 | 166,167 | 30.03 | 33.4 / 33.4 | 27.322 / 42.623 |
| Frostline spawn | 50 | 154,156 | 30.03 | 33.4 / 33.4 | 32.233 / 48.000 |
| Frostline road | 52 | 106,075 | 30.03 | 33.4 / 33.5 | 32.804 / 55.769 |
| Frostline plaza | 63 | 183,962 | 30.03 | 33.4 / 33.4 | 26.892 / 39.683 |

120 paired drawn frames per pose, live clock, acknowledged 1× boot / 4×
measurement fence, 402×874 CSS / 804×1748 canvas, muted phone profile.
Both floor rows pass, complete, exit 0 in 51.970 s, with no interval
>100 ms or page fault. The diagnostic 30 µs/draw maximum is still red;
no plot-specific CPU ask is routed from it. The prior matched Night
Market control and deferred `OB8-RENDER-CPU` attribution remain explicit
for their own source, rather than being relabelled as this HEAD's control.

The changed generators write motes/glints to Glow, while coarse-lighting
changes only render material/nodes. The collider construction, landmark
shape/placement, layout solids and maintained route are unchanged.
The previously completed maintained walks remain 0 stuck / 0 bounds;
no duplicate physics proof is inferred or claimed at this preview.

Mosslight Chromium spawn-process peak: **704 MiB** (about **738.2 MB
decimal**), 0 page errors. The rounded renderer/GPU sample components
are MiB; their sum is not relabelled as exact bytes.

Frostline Chromium spawn-process peak: **699 MiB** (about **733.0 MB
decimal**), 0 page errors. These memory visits were sequential; their
60 fps observations are not substituted for the 4× paired floor rows.

**Window context:** after sp-x6's single clean prime/warm cohort ended,
the two memory browsers completed and closed. The final pre-Simulator
pool check still showed a Driftwood `grid-long.mjs` browser and Coral's
capture. sp-x1 incorrectly announced drained slots and started the
reader before acting on that result; the coordinator received an explicit
correction. Coral's capture then refused at its dome guard and closed;
the pre-existing Driftwood browser and Ember MOSS batch can overlap this
window. No active peer job was interrupted. This is an official bounded
quiet reading, **not a claim of an otherwise idle machine**, and no
plot-specific timing cause is inferred from its measurements.

| Official Simulator / pose | Max draws | Triangles (median) | Median / p5 fps | p95 / worst ms | Work / callback p95 ms |
|---|---:|---:|---:|---:|---:|
| Mosslight spawn | 60 | 160,090 | 30.303 / 29.412 | 34 / 34 | 3 / 34 |
| Mosslight road | 63 | 125,182 | 30.303 / 29.412 | 34 / 34 | 3 / 34 |
| Mosslight plaza | 65 | 168,854 | 30.303 / 29.412 | 34 / 34 | 3 / 34 |
| Frostline spawn | 58 | 168,413 | 30.303 / 29.412 | 34 / 34 | 4 / 35 |
| Frostline road | 56 | 106,867 | 30.303 / 29.412 | 34 / 34 | 4 / 34 |
| Frostline plaza | 65 | 184,921 | 30.303 / 29.412 | 34 / 34 | 3 / 34 |

The official pair completes **90.671 s, pass, exit 0**, 120 drawn frames
per pose. Safari phone viewport 402×714, canvas 804×1428, live clock,
2× render scale, no CPU throttle. No intervals >100 ms, page/runtime
errors, context loss or crash. No plot timing miss is routed.

| Native conservative envelope | Playing B | Loading B | GPU peak B | Native playing / loading samples | GPU reads |
|---|---:|---:|---:|---:|---:|
| Mosslight | 234,242,966 | 1,239,111,398 | 28,259,742 | 215 / 139 | 46 |
| Frostline | 258,379,504 | 1,281,253,904 | 32,751,864 | 218 / 74 | 47 |

Each native visit retains one navigation `Inspector closed` gap; no gap
is treated as zero. Playing meets the 1.0 GB aim and 1.2 GB hard cap;
loading meets its separate 1.8 GB ceiling. These are Simulator regression
readings, not physical-device clearance. The reader owns `sim-lane` and
`sim-quiet`; no ad-hoc caller takes quiet. End notices went to sp-x2 and
sp-o2, quiet reports inactive, Simulator reports 0 / 1 booted, and preview
4400 stopped after its sole measurement use was released. No browser or
owned build/model work remains. Coral still waits for its final board.
