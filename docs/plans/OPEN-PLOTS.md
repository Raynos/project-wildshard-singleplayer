# Plan: OPEN-PLOTS — build the other 18 open plots the way Night Market was built

**State:** `in progress` 2026-11-03 ~08:30 — **Jake authorized building every open plot, 3 Opus lanes (G990)**, with the overnight approach (§0). Six plots are built (Night Market, Lantern Bayou, Frostline Peaks, Ember Forge, Coral Drift, Mosslight Ruins; [build-out](../../project/archive/2026-11-03-open-plots-build-out.md)); twelve are left. The four new plots' themes and mockups are §4b (the [new-unique-plots](../../project/archive/2026-11-03-new-unique-plots.md) mini plan is folded in). Was `parked`.

## 0. How the rest get built (G990, 2026-11-03)

Jake played the overnight plots: *"good enough."* The twelve left are built the same way, to the same bar.

- **Approach.** The [build-out plan's](../../project/archive/2026-11-03-open-plots-build-out.md) pipeline (§4 there), on the tile kit (G978): OP3's template writes the stub; a mirror-symmetric 8 × 8 of 62.5 m tiles; the shared kit retinted by the plot's palette; **one landmark** (Hunyuan3D 2.1 won Ember's furnace, Coral's arch and Mosslight's tower; TRELLIS.2 or a Blender script when better) and 2–3 theme tiles; life (bar 7) and native audio rows; then the **G983 look loop**: in-engine captures, codex `image_gen` remasters as the target, 9-angle rounds. The builder rules each round itself (G872) and logs it.
- **Look target.** Round 62 (`art/grid/round-62-open-plot-palettes/<nn>-<slug>.jpg`) for the original ideas; round 75 (§4b) for the four new ones.
- **The bar.** The overnight bar: every pipeline step met, phone budgets (§6) held, walk 0 stuck, a final board. Each plot also gets the **8 golden views** (`art/open-plots/golden-2026-11-03/` method: cameras.json + a scored board); the scores steer fixes, they do not gate (Jake's "good enough"). **G994: the plots are grid filler.** Night Market, Frostline, Coral and Bayou are accepted as they are; only Ember Forge and Mosslight get the G992 relight; new plots get no look rounds beyond the pipeline's.
- **Every built plot also:** a SHARD SELECT card whose thumb and backdrop are in-engine captures (G987), and a place in the 5 × 5 title hero's frame when it is re-shot (G986).
- **Lanes.** **3 Opus lanes, never 5** (G990). Opus owns everything the player sees (G848): landmark, theme tiles, final layout, look rounds, billboard fixes. Codex lanes: template stubs, audio rows, OP4 captures, readings, row closes.
- **Cost (measured overnight, wildshard-v estimate).** ~3 Opus + ~3.4 Codex lane-hours a plot; ~2 % Claude and ~1.5 % Codex weekly a plot. The twelve: ~25–35 % Claude, ~20 % Codex, about 2–3 nights.
- **Order.** Wave A: Jungle Ziggurat (OP13), Patchwork Fairground (OP7), Saltwind Lighthouse (OP9). Wave B: Fossil Badlands (OP21), Desert Ruin (OP12), Sky Harbor (OP11). Wave C: Starfall Observatory (OP15), Thin Ice (OP18), Clockwork Canyon (OP19). Wave D: Pastel Alien Plain (OP20), Floating Island Race (OP22), Showcase Template (OP5, last: G971). OP26 (billboards) goes first, before wave A, because every plot reuses the posters. Then OP23, OP24, OP25.
- **§7's questions are answered:** all plots (G990); round 62 / 75 targets, the builder picks (G872); Night Market's budgets; no play loop (G971); the new ideas took their cells (G972–G982); Showcase last; 3 Opus lanes (G990).


**Wave A Codex half (2026-11-03, sp-x6): done.** Jungle Ziggurat
and Patchwork Fairground use the established OB7 audio path: two MiniMax
Music 3 score takes, one bed and six positional SFX, each compared between
MOSS v2 and Stable Audio 3 Medium; package ≤3 MB, retained credits and
native bar 10 before closure. Briefs and offline waltz-meter checks are
`878e5311af`; no audio is activated by that source. Plot owners supplied
the six real horizontal probe locations. OB8 Chromium pair, separate
memory, official Simulator window and maintained walk follow each final
board/source. Saltwind's real source is `e28e863753`, final board
`ec9c29fdfc`; publication `678d952bb0` and activation `f8a1406288` pass
full native bar 10 in 15 s before landing. Score B plus five local spots
use the canonical shared Coral bed, with a named gap: no squall rain or
foghorn in the bed. Actual cell (0,2); X1/X8 final readings are complete,
including the separately authorized preserved-diagnostic grid admission.
Opus owns all visual source and look rulings (G848).

Audio publications: Jungle `add58749da` (1,240,450 B) and Fairground
`02c7ca0db0` (1,341,748 B). Fairground activation `8bdf53f635` passed
full native bar 10 before landing: own recorded B, bed plus five spots,
six decoded loops, all heading pan flips, errors[]. The coordinator
approved five spots after all eight paired flag takes failed top five;
flags stay unshipped with all failures recorded. Exact audio-only wire
increase +702,751 B preserves the old 44,293 B margin. Fairground OB8
readings are complete on `8bdf53f635`: matched Chromium pair, separate
memory, maintained walk (0 stuck / 0 out), official quiet Simulator
(plot and four junction headings report 30 fps, p95 34 ms; memory caps
hold). The raw CPU-target and home-grid strict timing misses stay
visible in [the readings](../reviews/open-plots-wave-a-readings.md).
Jungle's Codex half is complete on **61a326a292** / build
`61a326a-mw14hipi`: audio activation `1c287c7c4b`, O1 corrected geometry
`9c82257231`, eight-view board/goldens `42fd0da110`, and both maintained
walk legs (188.043 / 74.297 s, all 14 waypoints, 0 stuck / 0 out under
240 s each). Fixed road bar 7 identifies native egret drift and lamp
flicker; O1 confirms both. Full native bar 10 passes again in 19 s.
Chromium pair 53.431 s, separate memory 66 s and official quiet Simulator
95.159 s are whole: plot and four actual junction headings report 30 fps,
p95 34 ms; native memory caps hold. CPU/draw and strict timing misses
remain in [the readings](../reviews/open-plots-wave-a-readings.md).
Original walk/life failures remain in the audio review. Final phone wire
5,937,673 B stays below 5,981,239 B. No caps or verification rules change.
G999 lifted after verified Nine release `0b5d27d384`; Saltwind/Fossil
preparation continues under the single-model lock, skipping official quiet.
Saltwind's failed bed takes stay unshipped; the coordinator directs a
shared reference to Coral's qualified coastal bed if its ear/rank check
fits, otherwise spots ship with a named bed gap. Details and byte-proof
limits are in [the audio review](../reviews/open-plots-audio.md).

**Wave B Codex stubs (`8035bdf6ec`, 2026-11-03, sp-x9): historical source-preparation boundary.**
Fossil Badlands already has sp-o2's real OP3 source `d54dacb946` and
maintained route `4e9530bc4b`; preserve its hand-owned theme layout and
activation. Desert Ruin (OP12) and Sky Harbor (OP11) now have inert OP3
recipes, generic-palette scaffold layouts/descriptors, and eight canonical
TEMPLATE dome camera sets each. Their actual committed grid bindings are
`open-plot-3-0` at **(1,-2)** and `open-plot-4-4` at **(2,2)** respectively;
Fossil is `open-plot-1-0` at **(-1,-2)**. No historical plan coordinate is
used to move an instance. Both descriptors remain `activated: false` and
`shardSelect: false`; outputs, grid, live map, look and assets are untouched.
The generic palette is scaffolding, never theme art approval (G848).

The two provisional continuous south-entry/plaza-seam walk routes are
maintained inputs, not completed walk readings. Opus must adapt them to
final terrain before the maintained zero-stuck check. All three Wave B
names are accepted by the G950 tiling-report selector; its ordinary CURRENT
and non-empty-tile admission remains unchanged, so inert placeholders
refuse rather than produce a fictitious report. Audio and post-board
readings remain with sp-x6; all visible building/activation stays Opus-owned.

**Wave C Codex stubs (`b725870570`, 2026-11-03, sp-x9): historical source-preparation boundary.**
Starfall Observatory (OP15), Thin Ice (OP18) and Clockwork Canyon (OP19)
each have an inert OP3 recipe, generic starter-palette scaffold layout and
inactive descriptor, plus eight canonical TEMPLATE dome manifests.
Actual committed bindings: Starfall `open-plot-3-4` at **(1,2)**; Thin Ice
`open-plot-1-4` at **(-1,2)**; Clockwork `open-plot-4-3` at **(2,1)**.
All stay `activated: false` and `shardSelect: false`. Outputs, grid, live
map, look and native assets are untouched. The reference art is provenance,
not a theme palette or visual approval (G848).

Three provisional continuous south-entry/plaza-seam routes and G950
tiling selectors prepare their later checks. No walk or measured tiling
report is claimed: final terrain needs Opus's route adaptation and the
maintained zero-stuck check, and report selection still requires ordinary
CURRENT admission and non-empty tiled rows. Wave B's Codex follow-through
remains open until each Opus final board: sp-x9 owns Chromium/control,
separate memory, maintained walk and goldens; sp-x6 owns audio/native bar 10,
body/wire audit and the official Simulator window. Exact source/build and
capacity are agreed at each natural boundary; no duplicate Jungle run
(Jungle's complete reading cohort stays with sp-x6).

**Final audio-containing readings ownership (2026-11-03, sp-x1).**
The coordinator transferred sp-x9's readings backlog to sp-x1, then added
Pastel Alien Plain (`6aaef37e93`) and Showcase Template (`6d8d10289d`): ten
plots including Fossil, Saltwind, Sky Harbor, Starfall, Thin Ice, Clockwork,
Floating Island Race and Desert Ruin. Sp-x1 owns matched Chromium/control, maintained walk
and the eight-view golden bridge; sp-x8 owns separate memory and official
Simulator readings. Sp-x6 owns audio/native bar 10, body/pack/wire proof,
activation and joint row integration for Saltwind/Fossil/Clockwork/Desert/
Floating Island Race/Showcase; sp-x2 authors Sky Harbor/Starfall/Thin Ice/
Pastel audio under their agreed 4/6 split. Completed Jungle and Fairground
readings stay with sp-x6, covering all twelve plots. Exact final SHA/build
and shared preview leases arrive from the audio owner before any cohort.
[The shared readings page](../reviews/open-plots-final-readings.md) records
measured results; **5/10 final cohorts are complete: Saltwind, Sky Harbor, Starfall, Thin Ice and Pastel**.
Saltwind's actual cell is **(0,2)** / `open-plot-2-4`; its maintained
14-waypoint route completes in 164.0762 s under the original 180 s bound.
The other five await their whole final cohorts. No visual or guard changes.


**Saltwind final audio readings (2026-11-03, sp-x1).** Exact activation
`f8a1406288` / build `f8a1406-mw167rcy`: matched Chromium/control completes
six ×120 paired frames (Saltwind draws 44/53/53, p95 33.4 ms; unchanged CPU
and strict-timing misses retained). Maintained walk reaches all 14 waypoints,
0 stuck/out in 164.0762 s under the original 180 s bound. All eight golden
rows are read green, with sp-o3's explicit existing Pine foreground artefact
classification and no promotion. [Full source-bound results and board](../reviews/open-plots-final-readings.md#saltwind-lighthouse--walk-and-golden-bridge-sp-x1).
Sp-x8's standalone results and original 364.444 s grid refusal remain
recorded there. Harness `060198eb6c` preserves entry/Inspector diagnostics
alongside unload errors, with unchanged caps and guards. One coordinator-
authorized fresh grid-only admission completes in **64.754 s**: five
120-frame windows, zero skips/errors, 30.303 fps / p95 34 ms. All four
actual junction neighbours are near, pending empty and crossing settled;
road current is null and residents empty (near visibility, not four live
gameplay worlds). Pooled-page envelopes are 909.987 MB playing and
1,322.639 MB loading, with no 1.2 GB grid-page cap claim. The original
Simulator/Inspector cause remains unproved. Closure `2ee191dacf` completes
OP9; CPU-target/strict-timing misses and named look gaps remain visible.

**Starfall walk qualification (2026-11-03, sp-x9).** The ordinary maintained
`scripts/open-plots/walk.mjs` ran under the browser lane on a shared lease
of `d4d4b17674c7e80fb3beb8c16de1fbd14ff2e064`, actual build
`d4d4b17-mw13gps7`. Muted Chromium as iPhone 16 Pro, phone tier / 2×,
live clock: one continuous leg reaches all **14 waypoints**, **0 stuck**,
**0 out**, complete. The final trace reaches waypoint 13; endpoint
**(0.001, 0.021, -61.976)**, max Y **2.282 m**, reported route time
**164.478 s**. No route, collider, native controller or gate changed;
no hovering or per-waypoint teleport. The route source is the exact pin's
`scripts/physics-route.json` (SHA-256
`2960352a3938ff64217de339510714c0a8b9e43a35e4f7c7aaa775367226a443`).

The final labelled board and all eight committed golden views were read;
G994's no-star sky, omitted plaza billboard and canal-ring gaps remain
explicit. This walk qualifies geometry only: audio, matched render/memory
and official Simulator readings stay open until the audio-containing
candidate. Raw route and result remain in `tmp/sp-x9-op15/`; browser
closed and the shared preview lease released normally.

**Wave D Codex stubs (2026-11-03, sp-x9): historical source-preparation boundaries.**
Pastel Alien Plain was prepared and handed to its Opus owner first in
`f6d0bd6a01`: actual `open-plot-alien-plain` / `open-plot-4-0`, cell
**(2,-2)**. Floating Island Race follows as `open-plot-sky-race` /
`open-plot-2-0`, cell **(0,-2)**. Showcase Template was refreshed last:
`open-plot-showcase-template` / `open-plot-sw`, cell **(-1,-1)**, correcting
the capture registry's obsolete `open-plot-2-4` binding. Its recipe and
inactive descriptor now use the existing output's teal accent and retain
the generic palette; its eight existing canonical camera geometries stay
unchanged. No grid cell is moved.

Every stub is generic scaffold preparation, inactive and off SHARD SELECT
at its boundary. Race adds eight canonical TEMPLATE domes; all three have
provisional continuous south-entry/plaza-seam routes and G950 selectors.
No theme, walk, capture or performance qualification is inherited by a
later activation. Opus owns all visible source, final terrain/route
adaptation and activation (G848); Showcase's visual work remains last.
Live outputs, grid, map, audio and native assets are unchanged by these
stub commits. The maintained template admission and ordinary CURRENT /
non-empty tiled-report guards remain intact. The foreign loose Jungle
route remains outside these HEAD-only patches.


**Sky Harbor final audio readings (2026-11-03, sp-x1 + sp-x8).** Exact
`a8593f8ac6` / build `a8593f8-mw176ax3`: six ×120 matched Chromium/control
frames, Sky draws 45/51/53 and p95 33.4 ms; original CPU/strict misses retained.
Maintained walk all 14 waypoints, 0 stuck/out in 164.0586 s; eight golden
rows read green with sp-o2's explicit Clockwork/built-neighbour classification,
no promotion. X8's `eb20276955` gives all eight official Simulator windows
floor passes, standalone native envelopes 254.214/760.828 MB playing/loading,
and pooled junction 897.578/840.485 MB; actual four-neighbour near visibility,
pending empty and settled. Strict 33.3 ms flags remain false. [Full source-bound
readings and reviewed board](../reviews/open-plots-final-readings.md#sky-harbor--walk-and-golden-bridge-sp-x1).
The complete reading cohort is 2/10; the audio owner integrates OP11's other
requirements separately. No visual source changes or new look claim.


**Starfall final audio readings (2026-11-03, sp-x1 + sp-x8; locally held).**
Exact `aa33a361f5` / build `aa33a36-mw17vdnh`: six ×120 matched Chromium/control
frames (Starfall draws 47/54/54, p95 33.4 ms; original CPU/strict misses retained).
Maintained walk all 14 waypoints, 0 stuck/out in 164.4107 s under the original
180 s bound. Eight golden rows read green; sp-o3 classifies view 8 as the existing
Pine far-proxy state / D220, no fix or promotion. Original interruption and
quiet preflight refusal remain retained. X8's `c4adc34b31` has all eight official
windows floor-pass, standalone native 272.540/874.985 MB playing/loading and
pooled page 904.077/1,047.916 MB with all four junctions near/pending empty/settled.
[Full source-bound readings and reviewed board](../reviews/open-plots-final-readings.md#starfall-observatory--walk-and-golden-bridge-sp-x1).
Three of ten final cohorts are qualified; only two are published while Jake's
push hold remains. Audio-owner OP15 integration stays separate. No visual
source or golden promotion; the G994 look gaps remain.

**Clockwork walk qualification (2026-11-03, sp-x9).** Ordinary pinned
all-product admission passed for `f1d64e700c019186e175e15aa7c1442d7babc883`,
actual build `f1d64e7-mw14grkc`. The maintained `walk.mjs` ran under the browser
lane, muted Chromium as iPhone 16 Pro, phone tier / 2×, live clock.
One continuous leg reaches all **14 waypoints**, **0 stuck**, **0 out**,
complete: final trace waypoint **13**, endpoint **(0.001, 0.02, -61.975)**, max Y
**2.283 m**, reported route time **164.421 s**. Route source is the
exact pin's `scripts/physics-route.json`, SHA-256
`f530eb8647b457a2ac242ad2b1dc59805ec7c3864945188dadbda2d843dfd079`. No route, collider, controller or gate changed;
no hovering or per-waypoint teleport.

The final labelled board and all eight committed Clockwork golden views
were read. G994's sparse works terraces, missing canyon walls/waterfalls
and omitted plaza billboard stay explicit. The walk qualifies geometry
only; final audio, matched performance/memory and official Simulator
readings remain open for sp-x6's audio-containing candidate. Raw result
and route remain in `tmp/sp-x9-op19/`; the browser is closed and the owned
preview is released normally. Thin Ice's published final board was also
read; its retained walk and hero numbers above are credited to sp-o2,
not a duplicate run or final audio clearance.

Jake, 2026-10-28: *"You're approved to go and do the park plan, the draft park plan, how to build the rest of the open
plots."* This plan replaces Night Market pilot R1–R3 and remaster-open-plots RP2–RP4 (G774, G824). Decisions stay in
[shard-platform/decisions.md](decisions.md) until this plan has its own file. Read at HEAD 2f074203c9.

Sources: [night-market-pilot](../../project/archive/2026-10-28-night-market-pilot.md) (NM0–NM11),
[night-market-remaster](../../project/archive/2026-10-27-night-market-remaster.md) (RM0–RM14, the dome method),
[remaster-open-plots](../../project/archive/2026-10-28-remaster-open-plots.md) (the 19 ideas, the RM14 style-row how-to).
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
| Showcase Template | 1 | Source dev-map orange and grey, 1 m grid floors (KITCHEN-SINK G523; Jake, E523, 2026-11-02: not teal expo) | hub obelisk | med | 8 / 4 |
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
| OP1 | **done (2026-11-03, sp-o2): `43f9809f0d` + `d141a00252`, board [round 76](../../art/grid/round-76-night-market-op1/board.jpg)** (hero lantern family `e0c7a5d07b`; ~70 hero lanterns on thick ropes, sky lanterns gone, phone wire 8.13 of 8.23 MB). **Night Market lanterns (G827).** Board first: 3 takes of a hero paper lantern (ribs, paper, cap, tassel, inner glow; ~1.5k triangles LOD0, ~300 LOD1, instanced) and 3 rope styles. Then cut the lanterns to a few hundred, delete every sky lantern, hang every lantern on a thick, dark, sagging rope between posts or eaves; re-tune the light bake for fewer emitters | Opus | 6 h | Board sent; no floating lantern in the 8 domes; 30 fps and draws ≤ 154 hold; the new lantern is the shared family |
| OP2 | **Shared-kit extraction — done (2026-11-02).** Split `kit.mjs` / `tiledPlot.mjs` into a plot-agnostic core (Soup, grid, sockets, writer, pools, posters, kerb, far, light bake, paving) and per-idea builder sets; Night Market's H/G/S/C/L/N/P move to its own set; letters map to builders per layout | Codex | 1 d | All 18 current world GLBs (99,931,412 B) and all 52 read inputs are SHA256/size exact before/after. Night Market stays 64,289,012 B; the real style-row test uses seven different letters, and all eight collision goldens plus the 5,500-emitter control remain unchanged. Core grid/writer/sockets/paving/GLB construction is separate from Night Market geometry, seams and lighting policy |
| OP3 | **done (2026-11-03, sp-x8; G872 self-applied). Per-plot template generator.** One script: slug → layout stub, style row, `outputs.json` row, look key, map row, dome cameras from the round-62 sheet, cell swap for new ideas. Its first output is Showcase Template | Codex | 0.5 d | A new idea goes from nothing to a building plot (shared families, its palette) in one command |
| OP4 | **Batching — done (2026-11-03, sp-x9). [24 sheets + junction](../../art/open-plots/op4-b616c06/README.md).** One dome-capture run and one board-maker over any list of plots; one Chromium reading at a ring junction with all built neighbours in view | Codex | 0.5 d | One command captures 3 plots × 8 domes and makes their labelled sheets |
| OP5 | **Built and qualified except the official Simulator reading (row corrected 2026-11-04, sp-o5).** Landmark (Showcase obelisk) `d9cf01a208`, activation `a6e3fa3a6b`, audio published `384d8c2c8c` and bound `b00b361bd5`, walk legs 0 stuck / 0 out and eight reviewed green golden views bridged on final source `b752d49037` (`d3c0532f86`, sp-x1); open: memory / official Simulator reading (Codex). Earlier state: inert OP3 stub refreshed last (2026-11-03, sp-x9); visual build stays last per G971. Showcase Template: actual instance `open-plot-sw`, cell (-1,-1); generic starter palette, inactive/off-card descriptor and eight existing TEMPLATE dome geometries retained. Capture registry corrected from obsolete `open-plot-2-4`; provisional walk/report inputs added | Opus + Codex | 8 / 4 h | Pipeline steps 1–8 met (§3) |
| OP6 | **done (2026-11-03, built by the [build-out](../../project/archive/2026-11-03-open-plots-build-out.md) plan as OB2–OB6; leftover look gaps on BURN-DAMAGE-LIST).** Lantern Bayou (wave 1; reuses OP1's lantern and the strings) | Opus + Codex | 12 / 4 h | Steps 1–8; frees a repeat cell |
| OP7 | **done (2026-11-03, sp-o2 + sp-x6).** Patchwork Fairground: final visual source `15efc85eee`, [final board](../../art/patchwork-fairground/round-3-final/board.jpg) `80ba3ebf58`; audio `02c7ca0db0` + activation `8bdf53f635`, full native bar 10 passes (B, bed + five qualified spots; failed flags stay unshipped). [OB8 readings](../reviews/open-plots-wave-a-readings.md): Chromium/control, separate memory, walk 0 stuck/out, official Simulator plot + four junction headings 30 fps / p95 34 ms; native+GPU caps hold. Existing matched CPU-target and home-grid strict misses retained, not waived. Actual committed instance `open-plot-0-0`, cell (-2,-2). Look target [round 75](../../art/grid/round-75-new-plot-palettes/03-patchwork-fairground.jpg), theme §4b | Opus + Codex | 12 / 4 h | Final board, audio and readings complete; OP23 all-plots-built reading remains open |
| OP8 | ~~Mushroom Hollow~~ **dropped (G977)**: Jungle Ziggurat (OP13) takes its cell (-2,2) | Opus + Codex | 16 / 5 h | Steps 1–8; takes a repeat cell |
| OP9 | **done (2026-11-03, sp-o3 + sp-x6 + sp-x1 + sp-x8): landmark `749d7e7f44` (Blender script), harbour kit `2ebbc0ea97`, tiles and layout `c613015a52`, activation `e28e863753` (original wire 1,171,496 B and four plaza L1 draw rows approved), 8 goldens/final board `ec9c29fdfc` (road 110 draws, plaza 93). Audio `678d952bb0` + activation `f8a1406288`: full native bar 10 before landing, 15 s, score B, shared canonical Coral bed and five local spots; no copied bed. Approved audio-only +1,004,042 B sets wire ceiling 2,175,538 B, preserving 10 B margin. Known gaps: sparser than round 75, no rain or beam; no squall rain or foghorn in the bed (local horn remains). [Final readings](../reviews/open-plots-final-readings.md) complete on immutable `f8a1406288`: matched Chromium/control, 14-waypoint walk 0 stuck/out in 164.0762 s, reviewed 8/8 goldens, separate memory, three standalone Simulator windows and the single authorized fresh grid scope (64.754 s, five ×120 frames, all four junctions settled). Original grid refusal, raw CPU/strict timing misses and unproved Simulator/Inspector cause retained. Closure `2ee191dacf`.** Historical inactive stub `9361210b9d`. Saltwind Lighthouse — [round 75 target](../../art/grid/round-75-new-plot-palettes/04-saltwind-lighthouse.jpg), actual `open-plot-2-4` cell **(0,2)**; historical G982 target (-2,1) does not move it. | Opus + Codex | 16 / 5 h | Final board, audio and readings complete; OP23 all-plots-built reading remains open |
| OP10 | **done (2026-11-03, built by the [build-out](../../project/archive/2026-11-03-open-plots-build-out.md) plan as OB2–OB6; leftover look gaps on BURN-DAMAGE-LIST).** Coral Drift (wave 2; builds the shared palms and lagoon water) | Opus + Codex | 16 / 5 h | Steps 1–8 |
| OP11 | **Done (2026-11-03, sp-o2 + sp-x2 + sp-x1 + sp-x8); original misses and look gaps retained.** Sky Harbor geometry `c6d4f23295`, [final board](../../art/sky-harbor/round-3-final/board.jpg), eight goldens and cards `f5aa4028e3`. Audio publication `38e01a3407`: qualified A, canonical Coral bed without a copied asset, five qualified spots; the airship hum, rigging and tower flag remain a named G872 gap. Full native bar 10 passes before landing on `3dbfcb0fc1-mw16svtm`; audio-only wire 4,384,382 B. All 158 prior file bodies and 32/34 old sections exact. Actual instance `open-plot-4-4`, cell (2,2). Final immutable `a8593f8ac6` / `a8593f8-mw176ax3`: matched Chromium/control `54579a5835`, native memory/Simulator `eb20276955`, final walk and eight reviewed golden views `36d821199a`. All 14 walk waypoints, 0 stuck/out; eight official windows meet the existing floor. Standalone native playing/loading 254.214/760.828 MB; pooled page 897.578/840.485 MB. Strict timing and render-CPU misses stay visible in the [final readings](../reviews/open-plots-final-readings.md), alongside the neighbour-only golden classifications; no physical-phone claim | Opus + Codex | 16 / 5 h | Final audio-containing cohort complete and published; native bar 10, body/wire and all reading scopes retained |
| OP12 | **Built and qualified except the official Simulator reading (row corrected 2026-11-04, sp-o5): audio bound `b00b361bd5`, walk 0 stuck / 0 out and eight reviewed green golden views (incl. the approved Nine QD1/G1005 neighbour boundary) on final source `b752d49037` (`d3c0532f86`, sp-x1; board `art/golden-runs/open-plots/desert-ruin/2026-11-04-b752d49037-board.jpg`); open: memory / official Simulator reading (Codex).** Built (2026-11-03, sp-o1). Desert Ruin: instance `open-plot-3-0`, cell (1,-2), on sp-x9's stub `8035bdf6ec`. Landmark `59a06db332` (gateway.py, Blender take C, G872; laid out at 52 m), activation `cad1dbd0a2` (desert.mjs: oases, tent rows, ruin courts, palm groves, sandy gardens; noon look; birds and lamps for bar 7; a walk leg through the gateway), approved debt: entry tiles ~496 KB (`cad1dbd0a2`), plaza L1 3 draws (`af4b65d614`), wire 5,525,056 B (`d90343121c`). [Final board](../../art/desert-ruin/round-2-final/board.jpg) and 8 goldens on `bf48edbf7c`: 5 6 5 7 6 6 5 6, mean 5.75, NOT YET (eye level: the gateway small from the road, wide bare paving; Nine's far silhouette floats behind the gateway, sp-o3's Nine fix, `383434a749`). In-engine card art (card off, G991). | Opus + Codex | 16 / 5 h | Steps 1–8 |
| OP13 | **Done (2026-11-03, sp-o1 + sp-x6).** Audio `1c287c7c4b`; corrected geometry `9c82257231`, final board/goldens `42fd0da110`, both walk legs and full Codex readings on `61a326a292` (all 14 waypoints, 0 stuck / 0 out; bar 7 two owner-confirmed sources; bar 10 pass; quiet Simulator plot/junction 30 fps, p95 34 ms; native caps hold). Original failures and raw strict/CPU misses remain in the linked readings. Historical build boundary follows: Landmark `1e9ac5a848` (ziggurat.py, now 66 m), builders `58dba85134`, activation `6f3683f9c5` (approved debt: entry tiles ~633 KB, plaza L1 3 draws, wire 5,178,863 B), look round R1 `87d997316d` (pools uncovered, ziggurat 55 → 66 m, avenue egrets out, deeper sky). [Final board](../../art/jungle-ziggurat/round-2-final/board.jpg) and 8 goldens `90957ed671`: 5 7 7 8 7 7 6 6, mean 6.62, GOOD ENOUGH. In-engine card art `d2e077f684` + `b0642bd794` (card off, G991). Player-view draws 86–112, ≤ 253k triangles (Chromium phone 2×). Those original qualification gaps close on the corrected source above. Jungle Ziggurat (wave 3; new; **takes (-2,2), G977**) — look target [round 75](../../art/grid/round-75-new-plot-palettes/02-jungle-ziggurat.jpg), cell (-2,2), G977, theme in §4b | Opus + Codex | 16 / 5 h | Steps 1–8; takes a repeat cell |
| OP14 | **done (2026-11-03, built by the [build-out](../../project/archive/2026-11-03-open-plots-build-out.md) plan as OB2–OB6; leftover look gaps on BURN-DAMAGE-LIST).** Ember Forge (wave 4; adds the lava water kind) | Opus + Codex | 16 / 5 h | Steps 1–8; frees a repeat cell |
| OP15 | **Built and on the grid (2026-11-03, sp-o3): landmark `bfe58c53e7` (Blender script), stars kit `647d7e7532`, tiles and layout `b316849cdc`, activation `d4d4b17674` (wire 4,873,412 B approved by wildshard-new; plaza poster dropped for tile 0/3/3 draws), 8 golden views and final board `ef737e7295` (road entry 123 draws, plaza 97), in-engine card art `47e3c11f9a`. Known gaps on the board: a mid-blue sky without stars, no plaza billboard, canals ring the plaza.** **Walk qualified (sp-x9):** exact `d4d4b17674` / `d4d4b17-mw13gps7`, one continuous leg / all 14 waypoints, 0 stuck / 0 out, complete. **Audio complete (sp-x2):** publication `aa4523e79a`, qualified B plus canonical Lantern Bayou night bed and six local spots; no continuous fountain or chimes in the bed is a named G872 gap. Full native bar 10 passes before landing on `060198eb6c-mw17gbp0`; all 158 prior file bodies and 32/34 old sections exact, audio-only wire 5,911,520 B. **Final cohort qualified locally (push hold):** immutable `aa33a361f5` / `aa33a36-mw17vdnh`, matched Chromium/control `446044a3dc`, memory/official Simulator `c4adc34b31`, walk/eight reviewed golden views `fd8257f640`. All 14 walk waypoints, 0 stuck/out; eight official windows meet the existing floor. Native standalone playing/loading 272.540/874.985 MB, pooled page 904.077/1,047.916 MB. View 8 is O3-classified Pine far-proxy state under D220/G908, with no fix or promotion. Strict timing/render-CPU misses and original look gaps remain explicit in the [final readings](../reviews/open-plots-final-readings.md); no physical-phone claim. Original inert OP3 stub `b725870570` is historical; actual instance `open-plot-3-4`, cell (1,2) | Opus + Codex | 16 / 5 h | All final scopes qualified locally; closure remains unpublished under Jake’s push hold |
| OP16 | **done (2026-11-03, built by the [build-out](../../project/archive/2026-11-03-open-plots-build-out.md) plan as OB2–OB6; leftover look gaps on BURN-DAMAGE-LIST).** Frostline Peaks (wave 4; builds the shared pines and snow) | Opus + Codex | 22 / 6 h | Steps 1–8; frees a repeat cell |
| OP17 | **done (2026-11-03, built by the [build-out](../../project/archive/2026-11-03-open-plots-build-out.md) plan as OB2–OB6; leftover look gaps on BURN-DAMAGE-LIST).** Mosslight Ruins (wave 5) | Opus + Codex | 16 / 5 h | Steps 1–8; frees a repeat cell |
| OP18 | **Final cohort qualified (2026-11-04, sp-o2 + sp-x2 + sp-x1 + sp-x8).** Thin Ice final lane geometry `4ec90cdc5f`, [final board](../../art/open-plots/thin-ice/round-3-final/board.jpg), eight goldens and cards `6801d341a4` (published). Opus reports one maintained walk leg, 0 stuck / 0 out, complete. Reported phone 2× hero draws above/road/top/plaza 61/46/93/47; wire tightened to 2,053,521 B. These are visual-boundary figures, not final audio-containing performance/memory clearance. Actual instance `open-plot-1-4`, cell (-1,2). Known final-board gaps remain documented. Audio publication `68e91f6a7f`: qualified A and B, six local spots, canonical Mosslight bed through the no-copy path. O2/G872 measured fit: -25.5 LUFS, LRA 4.9, flatness 0.30, irregular broadband 20 Hz–11 kHz. Named mismatch/gap: leaf rustle in an icy plot and no ice creaks or pings in the bed; local spots carry ice detail. Frostline was refused as a machinery drone (75% below 150 Hz, flatness 0.001, LRA 0.5); the full refusal measurements remain in credits/review. No ear claim or rank waiver. Native bar 10 passes before landing on `b218735623-mw1bc2bp`; audio-only wire 2,961,101 B, all 158 prior file bodies and 32/34 old sections exact. Immutable final audio source `6ce898ee5f`: matched C/control and separate memory/official Simulator are qualified. Fresh build `6ce898e-mw2c1971` preserves the qualified product index, 205 bodies and 201 ordered pack entries; maintained walk completes 14 waypoints in 164.0431 s with 0 stuck/out, and all eight golden rows are reviewed green (`4282235f9c`). Original official refusal/overlap and authorized fresh-process pass remain separate in the [final readings](../reviews/open-plots-final-readings.md) | Opus + Codex | 20 / 6 h | All final reading scopes qualified; original misses and look gaps retained |
| OP19 | **Built and on the grid (2026-11-03, sp-o3): clock tower `e45fc2a7de` (Blender script), clockwork kit `111dd6a283`, tiles and layout `7a672e59dc`, activation `9091bc1c56` (wire 5,503,249 B approved by wildshard-new), lamp-lined avenues `c40e60e600`, 8 golden views and final board `f1d64e700c` (road entry 115 draws, plaza 115), in-engine card art. Known gaps on the board: much sparser than round 62, no canyon walls or waterfalls.** **Walk qualified (sp-x9):** exact `f1d64e700c` / `f1d64e7-mw14grkc`, one continuous leg / all 14 waypoints, 0 stuck / 0 out, complete. **Audio in flight (sp-x6):** two MiniMax takes finish in 392 s (39.08/75.08 s decoded); duration, clipping and internal silence pass, vocal/theme qualification remains open. MOSS is parked after a 15 s pre-take memory-guard refusal: another long-running Codex session reports 16 GB, over the unchanged 15 GB process bound. Jake says no peer eviction, guard edit or unchanged retry; resume only when that session ends or shrinks. Credits and the six-anchor/seven-loop native binding are prepared without activation. **Open:** both-engine SFX comparisons, full native bar 10 and matched performance/memory/official Simulator readings on the eventual qualified audio source. Actual instance `open-plot-4-3`, cell (2,1); original inert OP3 stub `b725870570` is historical | Opus + Codex | 22 / 6 h | Steps 1–8 |
| OP20 | **Built and on the grid (2026-11-03, sp-o3): monolith `3058db8d24` (Blender script), alien kit `a4e5fe0e55`, tiles and layout `9ca23a5de4`, activation `c960ad91a8` (wire 3,029,239 B approved by wildshard-new; shared fix: an empty part writes no node, world bytes of the 16 other tiled plots identical), violet beds `0cd922ffd2` with wire row `baf4985b4a` (+179 B approved), 8 golden views and final board `6aaef37e93` (road entry 125 draws, plaza 116), in-engine card art `5a463b7524`. Known gaps on the board: flat sky without aurora or moons, sparser beds, no mushrooms (deliberate). Audio complete (sp-x2), publication `54573d2778`: qualified A and B, six local spots and canonical Frostline sub-hum through the no-copy path. O3/G872 measured/described fit: -24.1 LUFS, LRA 0.5, flatness 0.001, 75% below 150 Hz, 18.5 s duration with original 2.5–17.5 s loop. Named gaps: no continuous glassy insect chirps or breeze in the bed; six spots carry detail. Original chairlift provenance is retained; no chairlift in the plot or ear verdict is claimed. Native bar 10 passes before landing on `0a547b2ee0-mw1c29d9`; all 158 prior file bodies and 32/34 old sections exact, audio-only wire 4,088,773 B. Final source `5fcb0ac75a` has qualified matched C/control, separate memory and official Simulator. Fresh build `5fcb0ac-mw2cd3ec` preserves all 205 admitted bodies and 200 ordered pack entries; maintained walk completes all 14 waypoints in 164.011 s with 0 stuck/out and all eight golden rows are reviewed green. O3 classifies views 1/2 as neighbouring Nine presentation/residency state, not Pastel content; no promotion or fix. [Final readings](../reviews/open-plots-final-readings.md) retain the original misses and artistic gaps.** Original inert OP3 stub (sp-x9) is historical. Pastel Alien Plain: actual slug `open-plot-alien-plain`, instance `open-plot-4-0`, cell (2,-2); final visual/audio source and all reading scopes qualified | Opus + Codex | 22 / 6 h | All final reading scopes qualified; known artistic gaps retained |
| OP21 | **Done (2026-11-04, sp-o2 + sp-x6 + sp-x1 + sp-x8 + sp-x2).** Fossil Badlands geometry `1617441602`, [final board](../../art/fossil-badlands/round-3-final/board.jpg) and eight goldens `0d9824ebd5`. Audio publication `41bc4ce7c4`: measured A, six qualified spots and the canonical Night Market bed by reference. Named gaps: no dry wind layer in the bed, no crane/rope-pulley cue after six failed takes. All 28 comparisons retained, unchanged rank bar. Full native bar 10 passes before activation in 17 s on `7c9f46e0c2-mw1brs9p`: seven cue loops, sustained own score/bed, six positive gains and heading pan flips, pause/resume, errors empty. Package 1,226,129 B including the 220,893 B shared bed. Exact approved audio-only wire +911,291 B sets 2,927,540 → 3,838,831 B, preserving zero margin. All 158 prior files and 32/34 sections exact; only native audio/map source stamp differ, eight AAC bodies and 242 B client plan join. Map image exact via the sole baseline image and strict native contract; no literal old-map-byte claim. Actual instance `open-plot-1-0`, cell (-1,-2). [Audio proof](../reviews/open-plots-audio.md#fossil-badlands--offline-publication). Immutable activation `0e0f1ba1c3` / `0e0f1ba-mw1c0i2g` builds all products in 74 s and passes full native bar 10 on its committed runtime in 18 s; 200/201 candidate bodies exact, only the map source stamp moves and the image stays exact. X1/X8 qualify matched/control, maintained walk, eight goldens, separate memory and official Simulator on that exact audio source  Final C/control, memory and fresh-process official Simulator are qualified; current carrier `1bc5e17-mw2gfb2r` bridges all ten defining native roots exactly. G872 accepts only the 164 B map provenance stamp with the identical 20,598 B image and unchanged pack entry order/offsets. Maintained walk: 14 waypoints, 164.0247 s, zero stuck/out; eight goldens read green by sp-o2, with neighbour/fine-tile residency and tiny-marker shading notes retained, no promotion. [Final readings](../reviews/open-plots-final-readings.md#fossil-badlands--final-walk-and-golden-bridge-sp-x2-november-4). | Opus + Codex | 22 / 6 h | None |
| OP22 | **Built and on the grid (2026-11-03, sp-o2; this row stayed at the stub until sp-o5 corrected it 2026-11-04): race tower `e7a7e4a4c3` (Blender script `racetower.py`, 42 m, landmark + far GLB), race kit `6c8f5c8e2f` (racer, pit garage, grandstand), tiles and layout `5ede05ca59` (`skyrace.mjs`: four kart-circuit quarters, paddocks, garages, grandstands; entry poster at OP26's 3.0 m), activation `051f50eccd` (wire 3,767,340 B approved by wildshard-new), 8 golden views, [final board](../../art/sky-race/round-3-final/board.jpg) and in-engine card art `df817d0848` (6.00 against round 62; draws above 60, road 47, top-down 98, plaza 49). Known gaps on the board: four small circuits where round 62 has one loop round the plaza, the tower reads small from the road, sparse paddocks and garages, grey concrete fill, no chevron boards, Night Market banner poles on the forecourts. Audio (sp-x1): publication `384d8c2c8c`, bound `b00b361bd5`; final source `b752d49037` with native bar 10, C/control, Chromium memory, maintained walk 164.046 s 0 stuck/out and goldens 8/8 green `d3c0532f86` (views 1–4 accepted as Far Reach's far-tier neighbour state, sp-o2 G848). [Final readings](../reviews/open-plots-final-readings.md).** Original inert OP3 stub (sp-x9, `3a97fa75e1`) is historical. Floating Island Race: actual slug `open-plot-sky-race`, instance `open-plot-2-0`, cell (0,-2) | Opus + Codex | 22 / 6 h | Official Simulator reading open (Codex); known artistic gaps retained (G994: no further look rounds) |
| OP23 | **Plan-end readings.** The official Simulator reading on the grid with every plot built: inside three plots and at a ring junction | Codex (Sim lane) + Opus fixes | 0.5 d | Every plot ≤ 1.2 GB, 30 fps floor; the page does not crash |
| OP24 | **Open; safe unread subset done (2026-11-04, sp-x9; G1015 lane ends here).** Unused showroom bake `8d039b0cc0`; seven obsolete hologram/art tools and stale instructions `214a4020a7`; 38 unread assets removed and Frostline's live `billboard.webp` moved byte-identically to `poster.webp` in `49972e50e0` (164,802 B, SHA256 `49d49e6bc611…`; net public assets −4,247,230 B). [Frostline fresh before/after board](../../art/golden-runs/frostline-peaks/2026-11-04-7bbddef582-op24-board.jpg): all eight individual Chromium views read, 8/8 visually green; live phase/raster differences recorded, no raw-pixel-zero claim or historical golden promotion. Both ordinary builds complete; all 2,981 file bodies across 18 plots exact, 612 sections exact, 18 map provenance stamps only (raster images exact); actual pack members verified. **Remaining in flight (2026-11-04, sp-x6; G1012):** emitted legacy look materials and `hologram.graph.json` still have build readers, and shared SDK `farMode: 'add'` is an active contract; retire them with their consumers, not as unread files. `beam.graph.json` was already absent. Candidate body audit passes all 18 plots (only retired material/graph entries, exact library cost and map provenance stamps differ; raster images exact). Matched-parent Frostline view 3 is CLEAN per Opus (G848); full Chromium/WebKit bulk captures remain open and wait for the timed-slot END. No source retirement has landed. | sp-x6 (G1012) | Qualification in flight | Remaining material/graph and far-mode contract retired without changing the player view; net lines negative; push gate green |
| OP25 | **Done (2026-11-04, sp-o5): card art `f1bb3011fd`; holograms, billboards and signs superseded.** The three built plots without cards (Patchwork Fairground, Saltwind Lighthouse, Fossil Badlands) get in-engine card thumb, portrait and landscape (G987, `card-capture.mjs`, not the round-75 boards); Jungle's shipped with OP13; [board](../../art/open-plots/shard-select-cards/round-2-new-plots/board.jpg). No hologram, `billboard.webp` or `sign.webp` was made (G872): all 18 rows are tiled plots, only the unused showroom bake reads those files, OP24 deletes that path, and the four plots' real landmarks (OP7, OP9, OP13, OP21) and `poster.webp` are their art. Original row: **Placeholder art for the four new plots (was NU2) (Opus: the player sees it, G848).** `holo-subjects.tsv` rows from §4b's landmarks; refs and Hunyuan3D-2 holograms (`gen-refs.sh`, `batch-holograms.sh`, `clay-review.mjs`) taking the round-75 board's road-entry panel as the reference; `billboard.webp`, `sign.webp` and `thumbs/<idea>.jpg` from the round-75 boards (`make-art.sh` given that source). Into `public/assets/open-plots/<idea>/` | Opus | Four holograms pass clay review; the art matches the other ideas' sizes (billboard ≤ 250 KB) |
| OP26 | **Billboard clearance (Jake 11-03: "the tree clipping for the billboard is really fucking bad").** From [the billboard review](../../art/open-plots/billboard-review-2026-11-03/README.md) (51 defect panels, 27 billboards × 9 views): (1) a prop-free zone around each billboard: `tiledPlotCore.mjs` computes the poster footprints before the tiles, `kit.mjs` skips any model, tree or ruin inside footprint + 4 m (25 panels, incl. Mosslight's plaza tree); (2) entry boards above the road wall: `posters.entry.bottom` 0.6 → 3.0 in all layouts (24 panels, clears the road signs too); (3) Frostline's plaza board off the mountain: `posters.plaza.z` -54 → -62 (3 panels). Applies to every later plot through the template | Opus | 2 h | The review's 9 views re-shot on the six built plots show no defect panel. **Done** (fixes `e0cc0a074b`; re-shoot `52cbb3f421`, 243 core + supplemental views; Opus look verdict G848, sp-o5 2026-11-04: no board-plane intersection anywhere; all 24 entry approaches clear above the road wall and sign; the two 'occluded' frames are camera-in-prop artefacts, not defects: Night Market rear 12 m eye inside a stall (8 m rear clear) and Frostline supplemental front 25 m eye inside a pine canopy (8 other supplementals clear)) |
| OP27 | **Done (2026-11-03, sp-x9). Golden harness:** `408152befa`, CI fixture `f6ef0a305f`, failure diagnostics `e91247e794`. One command reads each plot’s `cameras.json`, rebases its original local poses onto the served product’s current cell and writes eight settled views plus a scored, labelled board. Real HEAD end-to-end on `b687d09-mw0v15sd`: Night Market 8/8 views, no errors, physical anchors/camera identity and residency fences pass. All eight rows read; neighbouring horizon changes at 2/3/8 are conservatively red, not a plot-look approval. [Harness board](../../art/golden-runs/open-plot-night-market/2026-11-03-b687d09b21-harness-board.jpg). | Codex | 2 h | `scripts/browser-lane.sh --max 20 node art/open-plots/golden-2026-11-03/capture.mjs --plot=<plot> --base=<complete preview> --out=tmp/<new-run>` (Python with Pillow/NumPy; see GOLDENS.md). |
| — | Jake plays the plots on live | Jake | — | His word |

Order: OP1 ∥ OP2 → OP3 → OP4, then waves 1–6 (OP5–OP22), then OP23 → OP24. OP1 goes first because every
later plot reuses its lantern and rope.

## 4b. The four new plots (folded in from the new-unique-plots mini plan, 2026-11-03)

Jake, 2026-11-03: the four new open plots go back into this plan; the mini plan is finished and archived ([2026-11-03-new-unique-plots](../../project/archive/2026-11-03-new-unique-plots.md)). Its grid rows are done (NU1 one grid, NU3 data and the cell swap; NU4 dropped with Mushroom Hollow). Its art row is OP25 above; building the four is OP7, OP9, OP13 and OP21, parked with the rest of this plan.

### Themes (final, G977 / G978)

Graphics only (G971): theme, identity, signature landmark, look, dressing and audio. No play loop, quest, verb or
encounter. Each keeps its own look (AGENTS.md). Accents are the free slots of `src/game/grid/catalogue.ts`.

**Built from tiles (G978).** Each plot is a mirror-symmetric 8 × 8 of 62.5 m tiles: a cross of straight avenues, four
identical quadrants, ONE landmark on a square plinth at the centre. The tiles are the shared kit (paving, kerbs, lamp
posts, bridges, props, trees, water, gate, strings) retinted by the plot's palette row, plus the 2–3 **theme tiles**
listed below. A theme tile another plot can use lands in the shared kit. The look target is the plot's round-75 board;
the palette line below is burned into it. G978 sharpened every round-1 and round-62 look so no two plots share a
palette: the round-62 lines of the other plots and the centre shards were checked.

#### Saltwind Lighthouse (`open-plot-saltwind-lighthouse`, accent `rose`) → (-2,1) · `04-saltwind-lighthouse.jpg`

**Palette (board):** *pewter squall, slate-green sea, whitewash and black tar, one red-banded light.*

- **Theme:** a northern fishing harbour on black basalt in a passing squall, late afternoon, one cold silver break on
  the horizon, slanting rain, wet reflective stone. The grid's only storm. Coral Drift is the turquoise lagoon and Sky
  Harbor the blue-sky timber docks; Saltwind has no turquoise, no sand, no blue sky, no timber docks or cranes.
- **G978 change:** black basalt and black tarred timber replace round 1's granite and ochre; the sea is slate green;
  the lighthouse is the only strong colour.
- **Landmark:** a white lighthouse with bold signal-red bands on a stepped basalt plinth; a cold white lantern room and
  a beam through the rain.
- **Theme tiles:** harbour-basin tile (square slate-green basin, basalt quay walls, bollards, two moored boats);
  cottage-terrace tile (a row of whitewashed black-roofed cottages); net-and-pot tile (drying racks, lobster pots,
  buoy posts). Corner boathouses are the cottage tile's variant; a basalt sea wall with surf closes the far edge.
- **Audio:** rain on slate, gulls, rigging creak, a far foghorn; a low fiddle-and-drone ambience.

#### Patchwork Fairground (`open-plot-patchwork-fairground`, accent `citron`) → (-2,0) · `03-patchwork-fairground.jpg`

**Palette (board):** *buttermilk morning, toy primaries on a clover, mustard and lavender quilt.*

- **Theme:** a toy-box travelling fair pitched on a quilt of square fields, a fresh morning under a warm buttermilk haze.
  Night Market is the dusk street market of stalls and lanterns; this is rides and tents in daylight.
- **G978 change:** toy primaries (tomato red, sunflower yellow, royal blue, white trim) replace round 62's candy pastels
  (pink, mint, baby blue), and the buttermilk sky keeps it off Sky Race's cobalt noon. The quilt fields are literal
  square tiles.
- **Landmark:** a giant Ferris wheel on a square plinth, white lattice spokes, gondolas alternating red, yellow, blue.
- **Theme tiles:** quilt-field tile (3 × 3 coloured field squares with box hedges and hay bales); carousel tile;
  big-top tile (corners). Striped booths, bunting and the helter-skelter pair at the entry are kit stalls and strings
  retinted, plus the helter-skelter as the entry gate's variant.
- **Audio:** a distant band organ, carousel bells, flags snapping; a bright waltz-time ambience.

#### Fossil Badlands (`open-plot-fossil-badlands`, accent `apricot`) → (-1,-2) · `06-fossil-badlands.jpg`

**Palette (board):** *lavender blue hour, oxblood and mustard strata, bone-white skeleton.*

- **Theme:** a palaeontology dig camp cut into banded clay badlands just after sunset. Not a desert: no dunes, no palms,
  no sandstone temple (Sunscar Dunes and Desert Ruin own those), no orange sunset.
- **G978 change:** a lavender blue hour replaces round 1's pearl overcast and round 62's bone-and-ochre noon, and the
  strata are bold painted-hills bands (oxblood, mustard, cream, charcoal), so it reads nothing like Desert Ruin's
  white-gold noon or Sunscar's orange dusk.
- **Landmark:** a colossal bone-white dragon skeleton in a square stepped excavation pit, ribs arching high, timber
  scaffolding and ladders.
- **Theme tiles:** dig-trench tile (a square terraced trench with a string grid); banded-mesa tile (a flat-topped
  stepped block, edges and corners); camp tile (canvas tents, sorting tables, crates). Hand cranes and mine-cart rails
  are kit props.
- **Audio:** dry wind through the mesas, trowel scrape, canvas flap, a far hawk; a sparse guitar-and-marimba ambience.

#### Jungle Ziggurat (`open-plot-jungle-ziggurat`, accent `jade`) → (-2,2) · `02-jungle-ziggurat.jpg`

**Palette (board):** *rain-washed teal afternoon, cinnabar-red temple, jade pools, saffron bands.*

- **Theme:** a living, freshly painted Mesoamerican temple town just after a tropical rain: a teal sky clearing behind
  white cumulus, a faint rainbow, wet glossy stone. G977 took it off the spare list for Mushroom Hollow's cell.
- **G978 change:** to stay clear of Mosslight Ruins (grey-green overcast, ivy, glowing emerald), the temple is painted
  cinnabar red with turquoise and saffron bands, intact and clean; no moss, no ivy, no glow, no misty morning (round
  62's green mist is gone).
- **Landmark:** a stepped pyramid on the central plinth, cinnabar tiers with turquoise and saffron bands, a cream
  stair, a flat-topped temple house with a roof comb on top.
- **Theme tiles:** jade-pool tile (a square reflecting pool fed by small stepped waterfalls); stilt-house tile
  (thatched house on a square platform); painted-stele tile (patterns only). Round-canopy trees, causeways with rope
  rails and lamp posts are the kit, retinted.
- **Audio:** rain-forest birds, falling water, wooden wind chimes; a hand-drum and flute ambience.

#### Dropped: Mushroom Hollow (G977)

Jake, 11-02: *"having two open plots that are mushroom-based feels silly."* Alien Plain already carries glowing
mushrooms. Its round-1 mockup stays in `art/` as history; nothing is built.

### Mockups

#### Round 75: the look target (G978)

`art/grid/round-75-new-plot-palettes/`: one round-62-style 2 × 2 board per plot (1 ABOVE NEIGHBOUR, 2 ROAD ENTRY,
3 TOP-DOWN, 4 PLAZA; title and palette line burned in), each a codex `image_gen` edit of a round-62 sheet so the
cameras, road, kerbs and blocky tile look match the other plots. Blocky, mirror-symmetric, tile-built, one landmark;
no billboards (OP24 retires them). Prompts in its `README.md`.

| File | What it shows |
|---|---|
| `00-board.jpg` | The four road entries side by side, with the cell each takes |
| `02-jungle-ziggurat.jpg` | Jade pools in four quadrants, stilt houses and steles in rows, the cinnabar step pyramid |
| `03-patchwork-fairground.jpg` | Quilt-field quadrants with a carousel each, big tops at the corners, the Ferris wheel |
| `04-saltwind-lighthouse.jpg` | Four slate-green harbour basins with moored boats, cottage rows, the red-banded lighthouse in the rain |
| `06-fossil-badlands.jpg` | Terraced dig trenches, banded mesa blocks at the corners, tents in rows, the dragon skeleton in its pit |

#### Round 1: direction (history)

`art/open-plots/new-unique-plots/round-1/`, codex `image_gen`, each an edit of the in-game Night Market aerial (RM9,
`art/grid/round-68-night-market-gate/ingame-D1.jpg` panel 2): one painterly hero view per theme and an overview, with
the prompts in its `README.md`. Jake approved the themes from these (G974, G977). G978 replaced them as the look target:
they read as bespoke 500 m zones, not as a tile kit.

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

## OP4 batch capture tooling (2026-11-03)

The shared guarded capture loop, pinned registry adapter and independent board
maker are landed. [Capture protocol and commands](../../scripts/open-plots/CAPTURES.md)
cover any registered ordered plot list. OP3 owns the exact
`open-plot-captures/1` registry and camera manifests; OP4 reads both from the
full served source pin, never loose art or a guessed camera. The original
Night Market RM2/RM3/END CLI retains its selections and flat output layout.

The batch requires all eight domes, nine ordered committed views per dome,
normal entered-grid/physical-anchor readiness, phone tier/2×, the maintained
portrait framing, unchanged shipping rings and120 actual drawn frames/view.
Every image and camera source is SHA-bound. The separate board maker refuses
partial/error/reordered/duplicate receipts, changed JPEG bytes/dimensions,
and sheets over500KB. Plot, dome, source, view and camera provenance labels
are burned in; Bayou and Showcase remain explicitly TEMPLATE cameras.

One optional junction reading uses four fixed62° horizontal views from one
real road anchor between four assembled cells. Drawn layers, cell-centre
frustum tests, owned residency and full actual camera/state/frame receipts
must cover all neighbours. This is four-view coverage, not an assertion that
all four surrounding cells fit in one frame or a proof against occlusion.
No forced residency, scene visibility, lens/far change or synthetic draw.

Source validation:11 maintained pure controls PASS2.0s (existing dome
semantics plus actual image/board and admission refusals), root types and
named typed lint0. The pinned adapter independently reads the three committed
OP3 rows at`b9165aa0b8`:24 parsed domes/216 source views with exact camera hashes.
Correctness gates overlap PF13 explicitly; no timing acceptance follows.

**Qualified and done (2026-11-03):** full immutable source
`b616c06a02dfcf6d49a333ec35ad6a24a471c1d0`; 24 domes /216 unique views,
24 labelled sheets and four fixed junction views PASS. [Committed evidence,
full digests and limitations](../../art/open-plots/op4-b616c06/README.md).
The original18 completed domes were not repeated. Only the unrun six Showcase
domes and junction were captured after the B1 cause correction, in one bounded
command. Same source, two separately retained actual builds:
`b616c06-mw0dyp5q` and `b616c06-mw0k33gx`; no false single-build claim.
The standalone board-maker ran once over all three final receipts. All216
JPEG hashes, pinned camera hashes, ordered120-frame positive clocks and
original acceptance guards independently pass. All16 existing Night/Bayou
sheets reproduce byte-for-byte. All24 sheets +four images were inspected.

Junction(-0.5,1.5), world(-281.25,843.75), covers actual Pine, Night Market,
Thin Ice and Showcase drawn-layer/frustum/residency witnesses across four
unchanged62° standing views; `allCentresInOneFrame=false`. TEMPLATE and
placeholder imagery remains explicitly labelled; no art-direction approval,
forced residency or claim against occlusion follows.

B1's original guard refusal (`pending=[pine-hollow]`) and the separate
wait/read-race refusal remain raw failures. `fb1920bee6` + `92611f473e` wait
for normal settled admission and atomically return the actual ready snapshot;
no pending is ignored and every original postguard stays. No timeout, camera,
frame count, comparator or Pine/runtime change. Focused tests, types and lint
pass; source fixes are pushed. Separate X6 optional-admission lifetime
attribution is `69decd4aa4`, not a replacement for the actual b616 witnesses.
The first-run3211 builder /scheduled gates and brief O3 boundary overlap are
labelled shared-host, descriptive Chromium evidence; no isolated performance,
physical-phone or OP23 budget pass. Both own normal leases/browser cohorts
closed; no remaining OP4 capture or hardware work.


### OP3: source templates and per-plot construction (2026-11-03)

`node scripts/open-plots/template.mjs scripts/open-plots/recipes/showcase-template.json`
writes a layout/style/output/look/map candidate, all eight canonical camera
manifests and the capture registry. Existing products stay unactivated by
default. Their explicit later activation belongs to their build-out row;
new ideas require a named old-cell replacement and retain 25 unique slugs.
The tool refuses invalid accents/palettes/tiles/sockets, ambiguous cells,
hand-authored or edited layouts, changed cameras and concurrent source edits.

`layout.plot` selects Night Market, Lantern Bayou, Frostline Peaks or the
shared-family scaffold. Missing `plot` retains the original pilot. Only an
explicit scaffold may omit its landmark/poster; full builds retain their
ordinary material, input, product and physics admission. Frostline towers
accept three coordinates or a fourth positive sheave height. The Bayou and
Frostline stub files are unactivated owner starting points, not art approval.

Fresh original/candidate processes built all 18 existing world GLBs:
97,994,248 bytes and all 53 read-input hashes are exact. The generated
Showcase scaffold builds 13,502,112 bytes with real draw and collider meshes,
using only the three declared shared kit families and no theme asset. Its
existing output stays byte-preserved. This exact-output component overlapped
X2's DW loading cohort; no timing or native performance claim follows.
Nineteen controls in four suites pass, root types and named typed lint are
zero. G872 exact-output scope is self-applied; no art/physics qualification
is inherited by a future activation. OP4 remains X9's capture/board row.
