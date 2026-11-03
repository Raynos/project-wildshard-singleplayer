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
| OB0 | **In flight (2026-11-03, sp-x1; source + unit controls qualified, five WebKit entries pending). On SHARD SELECT (G984).** Frostline Peaks, Lantern Bayou, Ember Forge, Mosslight Ruins and Coral Drift each get a SHARD SELECT card (existing thumbs) that enters the plot standalone, public build too | Codex | 0.5 | Each of the five enters from SHARD SELECT on WebKit (iPhone 16 Pro); a test pins the five cards |
| OB1 | **done (2026-11-03, G972; `ffb6270346` + `913b810625`).** **G972, one grid.** `src/game/grid/singleplayer.json`: `nine-dragon-stack` takes (1,-1) in `grid.cells` (it replaces that Lantern Bayou copy), and `grid.developer` is deleted along with every reader of it (`src/game/grid/catalogue.ts`, `assembly.ts`, `copyIdentity.ts`, `entryDownloads.ts`, the grid tests, and the scripts that read it: `public-grid.mjs`, `frame-floor.mjs`, soak, parity, the world-map atlas and others; grep before deleting). Blender-template, pastel-plain and ink-cel-valley leave the grid. Fold the now-redundant `devserver` Nine entry if nothing else needs it | Codex | 1 d | One grid for public and Developer. Nine enters from its cell on a public build. The grid tests, `vitest related` and the boot smoke pass. Net lines are negative |
| OB2 | **Pilot: Lantern Bayou** through pipeline steps 1–8. Template additions that every later plot reuses (Codex): audio rows from the template, the bar-7 life check (pixel change per 500 ms in the 5 s clip), the bar-5 three-way board maker, and the per-plot tiling report (G950). Opus: the plot itself, and holding the landmark for the whole cell (§6) | Opus 2 + Codex 1.5 | 3.5 lane-days (was 5.5) | Board sent; the four hero views read as the 2 × 2 board, by eye; the layout is mirror-symmetric kit tiles plus ≤ 3 theme tile variants and one landmark (G978); the three-way board reads "better"; life visible; audio plays; ≤ 130 draws, ≤ 600k triangles, ≤ 1.0 GB in the Chromium reading; 0 stuck; the plot replaces its hologram |
| OB3 | **Frostline Peaks** (wave 2; builds the shared pines, snow and ice) | Opus 2 + Codex 0.5 | 2.5 (was 6) | As OB2. The peak lodge and lift are readable from the road entry and from the Far Reach side |
| OB4 | **Ember Forge** (wave 2; builds the lava kind) | Opus 1.5 + Codex 0.5 | 2 (was 4.5) | As OB2, plus junction J1 holds (§6) |
| OB5 | **Coral Drift** (wave 2; builds the palms and the lagoon water) | Opus 1.5 + Codex 0.5 | 2 (was 4.5) | As OB2. The sea-edge sides read at the 100 m view |
| OB6 | **Mosslight Ruins** (first free Opus lane; builds the ruin-stone tile) | Opus 1.5 + Codex 0.5 | 2 (was 4.5) | As OB2 |
| OB7 | **Audio batch** under the model lock. Pilot first, then the four: 5 scores (two MiniMax Music 3 takes each, on one listening page in the morning batch; the lane ships its recommended take), 5 ambience beds, about 25 spot SFX (MOSS v2 vs Stable Audio 3, the better take ships). Files go in `public/assets/music/<slug>/` and `public/assets/sfx/<slug>/`, with credits | Codex | 1.5 | Every plot meets bar 10; the credits file is updated; the audio stays within its ≤ 3 MB budget |
| OB8 | **Plan-end readings.** The official Simulator reading inside each plot, plus junctions J1 and J2 (§6) | Codex (Sim lane) + Opus 0.5 d fixes | 1.5 | Every plot meets bars 12–15 on the Simulator; the junctions hold; nothing crashes |
| OB9 | **Title hero re-shoot board.** After G972 and OB2–OB6, the 5 × 5 hero shows three of these plots, plus Nine Dragon at (1,-1). One labelled A / B / C board of re-shoots of the same NW-b framing | Opus | 0.5 | Board sent. Jake's pick ships, or the current hero stays |
| OB10 | **Night Market catch-up (G980)**: after OB2–OB6, bring the Night Market to the same tile-kit bar (landmark, dressing density, audio, phone perf) | Opus + Codex | — | Same bar as OB2 |
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

**2026-11-03: the four reusable tools are done on unit/type/lint checks.**
Three focused suites / **24 cases PASS in 8.0 s**, including exact motion
pixel counts and false-source/camera/lossy-image refusals, the real
five-second synthetic capture-port check, labelled JPEG generation and
unaltered native tiling/ownership controls. Root and scripts types and
named typed lint pass, including the declaration file. The 1206 × 2622
synthetic board was viewed and stays under 500,000 B. The actual audio
CLI smoke passes and emits the inert six-asset packet. No browser, app
build, shared publisher or native world is needed to land these tools.
Actual pilot capture/build/readings stay queued after PF13; these
controls do not qualify those live bars.

The audio packet remains inert until OB7 supplies assets, credits,
loop metadata and native catalogue binding. The life report counts
exact RGB changes in two or more owner-declared disjoint regions over
eleven lossless samples; it does not infer system identity or replace
the owner’s visible-life read. Four matching plot-local cameras form
the MOCKUP / PLOT NOW / NIGHT MARKET NOW portrait board, at most 500 KB.
Tiling uses ordinary CURRENT product admission and the existing strict
NT7 reader; missing products refuse without generation. None of these
tool controls grants the still-open pilot’s audio, motion, art, phone
performance or walk qualification.


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
