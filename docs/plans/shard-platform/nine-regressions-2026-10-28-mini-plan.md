# Nine regressions 10-28: SHARDFILE against LEGACY, one buildable list (G834)

**State:** `open` 2026-10-28 ~15:30 Cancun. Spike by a wildshard-v subagent for wildshard-new, which hands the rows to
lanes. Jake (10-28): *"Nine Dragon has some really obvious visual regressions, especially the shadows on the hands."*
Part of [close-out](close-out-mini-plan.md) after CO6; archives with SHARD-PLATFORM (CO8). Read and captured at HEAD
`4990c215fb`; start board: [CO6 Nine sheet](../../../art/legacy-vs-shardfile/round-1-2026-10-28/nine-dragon-stack-board.jpg)
(`93eb52800f`). Boards: [round-32](../../../art/nine-dragon-stack/round-32-shardfile-regressions/) 1–5.

## Summary

1. **Hands:** not a shadow. The ink outline hull draws with a default projection, so a black copy of the claw, glove,
   guard and blade edge sits off the real arms, toward the centre and in front of them.
2. **Wet stone:** the square floor, the Well balustrade and the stair treads are flat navy, with no joints, puddles or
   pool light. The streak cards still draw on top.
3. **City:** the facades are pale and flat with dark windows, and the far lit towers are gone from the sky. That is most
   of "the scene is darker".
4. The CO6 sheet's missing wet reflections do not reproduce at HEAD (all 9 views, both engines). NR5 re-checks them under
   CO6's own saved midday / clear settings.
5. All of it shows on Chromium and WebKit alike ([board 4](../../../art/nine-dragon-stack/round-32-shardfile-regressions/4-webkit-check-board.jpg)).
   None of it needs a look pick: every fix restores LEGACY.

## Regressions

| # | What | Where (board) | Cause | file:line | First bad |
|---|---|---|---|---|---|
| R1 | Black copies of claw, glove, guard, a 2nd cyan blade edge | [1-hands](../../../art/nine-dragon-stack/round-32-shardfile-regressions/1-hands-ink-hull-board.jpg); CO6 A–D | The hull graph projects by hand with the param `projection` (default `[1, 1, -1, -.2]`). HeldView writes it from `material.onBeforeRender`, but three's node handler overwrites `material.onBeforeRender` with its own callback at every draw. Measured: 0 hook calls in 10 frames; the camera is `[1.607, 0.949, -1.00006, -0.160]`, so the hull is drawn 0.62× narrow and nearer than the body. | `src/game/systems/viewmodel/heldView.ts:132`; `src/shards/nine-dragon-stack/generators/viewmodelGraphs.ts:103`; `node_modules/three/examples/jsm/tsl/WebGLNodesHandler.js:447` | Already bad on `08348223b9` (10-24, [board 5](../../../art/nine-dragon-stack/round-32-shardfile-regressions/5-bisect-floor-board.jpg)). The hook pattern dates from `0a80c5a717` (10-20) and `1668232c61` kept it; not bisected further |
| R2 | Floor, balustrade and stair treads flat navy | [2-wet-stone](../../../art/nine-dragon-stack/round-32-shardfile-regressions/2-wet-stone-flat-board.jpg); CO6 A, C | **Not isolated.** Ruled out: the coarse tiles (hiding all 20 changes nothing); the paint array (all 12 layers fetch); missing kit attributes (`kit:paifang` carries aFace / aMisc / aPat / aOff / aSpill). Leads: a `[programShare] graph:material wrote other code under a shared program key` warning on entry, and `AttributeNode … "position" / "normal" not found` (some build bound to the wrong geometry). Also check the light volumes `uLpVolA/B`. | `src/engine/render/graph/compile.ts` (program share); `generators/worldScenes.ts:235` (volumes) | **Good on `08348223b9`** (10-24 23:55, [board 5](../../../art/nine-dragon-stack/round-32-shardfile-regressions/5-bisect-floor-board.jpg)); bad on `93eb52800f` and HEAD. The 10-25…10-28 render and Nine producer series is the range |
| R3 | Facades pale and flat, windows unlit, far skyline towers and window dots gone | [3-facades](../../../art/nine-dragon-stack/round-32-shardfile-regressions/3-facades-windows-sky-board.jpg); CO6 B | Not the R2 break: the windows were already unlit on `08348223b9`, though the walls have paled further since. Leads: the architecture graph's window and spill terms; the sky towers in the painted sky / far layers. | `generators/architectureGraphs.ts`, `generators/facadeWindows.ts` | Before 10-24 for the windows; wall pallor in R2's range |
| R4 | 20 coarse tiles drawn inside the city; their GLB attributes are `_aface _amisc _aoff _apat _aspill` and the graph reads `aFace …` | (no visible damage near spawn) | The glTF custom-attribute renaming is not mapped back, so coarse stand-ins shade flat wherever they show (the far rim). All 20 are also visible while the city is resident; check that is intended. | `src/game/grid/cellClip.ts`, coarse product writer | Not bisected (T8 coarse rows, 10-28 `49e5f5a138`?) |
| R5 | CO6 sheet: no wet reflections at all | CO6 A–D | Does not reproduce at HEAD with default settings. CO6 used saved **midday / clear** settings, so the card gain (`lent cardOn`) may drop under a weather or time setting. | `generators/composite.ts:66` | Unknown |
| R6 | Rain strokes longer and brighter | every view | Not checked; the drizzle px scale (`uRain` index 3 from the buffer ratio) is suspect. | `generators/composite.ts:63` | Unknown |
| R7 | Jian talisman (fu) larger, red tassel shorter | 1-hands row 1 | Held cloth rows; check after R1 (the hull copy hides part of the tassel) | `generators/heldProfile.ts` | Unknown |

The LD4 gaps (`fp-arms` and six Sets missing from the declaration adapter) are registration coverage, not pixels. Every Set
in the capture is present (booth, parasol, pavilion, balustrade-panel). They stay
[legacy-deletion](legacy-deletion-mini-plan.md) LD4-ND rows and are not repeated here.

## Rows

Every row is done only when it **matches LEGACY on the same cameras on Chromium and WebKit, shown on a labelled board**.
Cameras: CO6's A–D ([cameras.json](../../../art/legacy-vs-shardfile/round-1-2026-10-28/cameras.json)), plus look-down,
facing-back, stall and sky. Capture muted through `scripts/browser-lane.sh` as an iPhone 16 Pro (portrait, phone tier,
2×) on a preview of HEAD.

| Row | What | Owner | Size | Done when |
|---|---|---|---|---|
| NR1 | **done `e944149bd6`** (board 6-nr1, G858 13-golden). Bind the hull's `projection` where the node handler cannot overwrite it: the mesh's `onBeforeRender` or the held view's per-frame camera write, or replace the param with the graph's camera projection node. Same audit for every `frame` row with `source: 'projection'`, and grep other `material.onBeforeRender` writers on graph materials. | Opus | S | No black copy or 2nd blade edge in the 3 hand rows of board 1; matches LEGACY on Chromium and WebKit, shown on a labelled board |
| NR2 | **done `3cadfddf16`** (board 11-nr2, G858 13-golden). Bisect R2 on `--rev` previews from `08348223b9` (good) to `93eb52800f` (bad), CO6 camera A only. Name the first bad SHA, then fix it (program-share key, bound geometry, lent volumes). | Opus | M | Floor joints, puddles, pool light, carved rail and stair edges are back; matches LEGACY on Chromium and WebKit, shown on a labelled board |
| NR3 | **open, sky half done `d64a1ade37`;** facade windows still brown (lead in Marks, `61e78aa305`). Facade lit windows, grime and the far skyline: whatever NR2 leaves, fixed in the architecture / sky graphs | Opus | M | Board 3's three rows match LEGACY on Chromium and WebKit, shown on a labelled board |
| NR4 | **in flight (2026-10-28, sp-x1 data / sp-o3 visual):** restore every explicitly declared native GLB channel name and storage type; no material, graph, placement or visibility change. Coarse parents remain prepared and are quadrant-masked after fine publication (`wholeRefinementCover.ts`). | sp-x1 data / sp-o3 visual | S | Data audit: 12 hash-verified existing coarse GLBs / 20 meshes, all six custom channels byte/type-exact; position/index identities unchanged. Seven focused controls and engine/SDK/scoped types pass. G844 board `a3830a984b`: [CO6 A-D before/after](../../../art/nine-dragon-stack/round-32-shardfile-regressions/10-nr4-board.jpg), Chromium, no visible change; entry warnings **18 before / 18 after**. **Acceptance remains open:** no AttributeNode missing-channel warnings and labelled far-rim LEGACY parity on both engines. Next loading/data lead: empty placeholders from `refiningWholeLibrary.ts:64`, separate from coarse intake. |
| NR5 | **done, does not reproduce** (`2097debb65`, board 8-nr5). Re-run CO6's exact entry (seed 357, saved midday / clear, 90 frames); if the cards vanish, fix the card gain under that setting | Opus | S | Wet reflections at A–D under CO6's settings match LEGACY on Chromium and WebKit, shown on a labelled board |
| NR6 | **open:** no rain cause found (Marks). Rain stroke length and opacity against LEGACY (`uRain` px scale) | Opus | S | 5 s clips each way show the same drizzle; matches LEGACY on Chromium and WebKit, shown on a labelled board |
| NR7 | **done `e2531efa60`** (board 9-nr7); view-F live sway is an open residual (Marks). Held cloth (fu, tassel) after NR1 | Opus | S | Board 1 row 1 matches LEGACY on Chromium and WebKit, shown on a labelled board |
| NR8 | **open:** sheet `a0ea22591f` matches at A-D; B-back gold sign and wall pallor still off (sp-o3). One closing sheet: CO6's A–D plus the 5 extra views, LEGACY against SHARDFILE, at the fixed SHA | Opus | S | The sheet matches LEGACY on Chromium and WebKit, shown on a labelled board; linked from close-out CO6 |

### Marks (sp-o5, 2026-10-28)

- **NR3, sky half: done** `d64a1ade37` (fix(tiles): keep never-culled meshes whole). The painted sky is a 2 km sphere its scene marks `frustumCulled: false`; `tiledMesh` partitioned it, its triangles clamped into the border tiles the 5 x 5 ring never holds, and its draw range stayed 0: no gradient, clouds or far lit towers. Board [7-nr3-sky](../../../art/nine-dragon-stack/round-32-shardfile-regressions/7-nr3-sky-board.jpg) (B and up 38 deg, Chromium + WebKit). **Facade half: open**, waiting on NR2: the window quads draw with the right data (83 % of 8,383 lit, warm tints) but shade flat like every kit surface; sp-o3's Float16 join fix is the likely cause, re-check on its SHA.
- **NR5: done, does not reproduce** `2097debb65`. CO6's entry (seed 357, saved midday / clear, phone tier): the reflection streaks draw at A-D on Chromium and WebKit, as strong as LEGACY. Board [8-nr5](../../../art/nine-dragon-stack/round-32-shardfile-regressions/8-nr5-reflections-board.jpg).
- **NR6: open, no rain cause found.** The composite's rain is LEGACY's term for term (cell 7 x 70 px, density, length, falloff, mix 0.55) with the same live values (`uRain` 0.55 / 0.14 / 520 / 2, `uDpr` 0.8, buffer 804 x 1362) and `uTime` advancing 1 s a second; the strokes read brighter on NR2's flat navy. Re-read after NR2.
- **NR7: done** `e2531efa60` (fix(nine): hang the jian cloth at the idle down). The cloth bake settled in the weapon bone's frame along its own -Y (the hilt); it now settles with the idle's down (`REST_GRAVITY`, measured on the shared rig). Board [9-nr7](../../../art/nine-dragon-stack/round-32-shardfile-regressions/9-nr7-cloth-board.jpg).
- **NR7 residual (open, M, not tonight):** view F (camera A looking down 55 deg, NR8 sheet) shows LEGACY's tassel streaming over the blade; LEGACY simulates the cloth live with the world's down turned into the view, so it swings as the camera pitches, while SHARDFILE bakes one rest at a level idle. Matching it needs a runtime view-gravity input to the cloth sway (the `aCloth` field), not a bake change.
- **NR3 facade half, re-read on `288396674e` (after NR2):** floors and stone are back; the near windows are still brown where LEGACY's are lit rooms. The brown panes are the `facade-windows` instanced quads (hiding them removes them); their data is right (Float32 `aWin` / `aWall`, 83 % lit, warm tints) and forcing every `aWin.y` to 1 changes nothing: the brown is `aWall`, the `nine-windows` graph's reveal, so `inGlass` is 0 everywhere and the interior ray misses the glass. Lead: the quad's W / H / camera come from `localToWorldVector` / `objectOrigin`, which are instance-aware only when the program compiles for an `InstancedMesh`; the entry logs `[programShare] graph:material wrote other code under a shared program key`. Also measured (no source edit, clean `288396674e` preview): the quads face the camera (98 % of near instances have it on their +Z side) and the graph's interior-mapping math, evaluated in JS on the real instance matrices and camera, hits the glass for 212 / 400 near quads at the pane centre, so the graph and data are right and the compiled program evaluates something else. Forcing a fresh build by a userData change did nothing (three keys programs without userData, so nothing rebuilt), and `reuseKey` (`nodeBuildReuse.ts`) does key by object class and `instancing`. Next (runtime TSL debug, the coordinator's recipe, no debug commit): on a clean `serve-build.sh --head` preview, from Playwright reach the `facade-windows` InstancedMesh through `window.__wildshard.world.game.rootScene`, give its material a colour node that writes W, H and inGlass (the `nine-windows` graph's `length(localToWorldVector([1,0,0]))`, `length(localToWorldVector([0,1,0]))` and the glass hit) or simply `localToWorldVector` / `objectOrigin` as colour, set `material.needsUpdate`, and screenshot `back`; red / green near 0 means the instance-aware ops lost the instance matrix in this program. The entry also logs `[programShare] graph:material wrote other code under a shared program key` (`engineNodesHandler.ts`), the one program-share lead. Probe scripts: `tmp/sp-o5-nine/look.mjs` (title entry, onLate camera, DUMP_JS / EXP_JS / EXP2_JS hooks, KEEP_VM=1) with `exp-glass.js`, `exp-facing.js`, `exp-unlit.js` (being cleared at the handoff: recreate from this note). The wall pallor near the top of the facing-back view is still paler than LEGACY.

### Marks (sp-o3, 2026-10-28)

- **NR1: done** `e944149bd6` (fix(nine): draw held ink hulls with the camera). The projection write moved from the hull
  materials' `onBeforeRender` (replaced by three's node handler at every draw) to each held mesh's own hook. Board
  [6-nr1](../../../art/nine-dragon-stack/round-32-shardfile-regressions/6-nr1-board.jpg) (A-D, Chromium + WebKit).
- **NR2: done** `3cadfddf16` (fix(nine): keep kit half channels when merging). Not program share: three's
  `mergeGeometries` rebuilt every channel as a plain `BufferAttribute`, so the layout bake's merged kits (and `kitx.merge`)
  wrote their half-float `aFace` / `aPat` as plain Uint16 words and the GPU read `kind` 16896 for 3. `mergeKits` keeps the
  half channel; `wholePieceJoin` had the same loss. Floor joints, puddles, pool light, rail carving and stair edges are
  back. Board [11-nr2](../../../art/nine-dragon-stack/round-32-shardfile-regressions/11-nr2-board.jpg) (A-D, Chromium + WebKit).
- **G858 for NR1 + NR2:** [13-golden](../../../art/nine-dragon-stack/round-32-shardfile-regressions/13-golden-board.jpg),
  A-D golden (`art/legacy-goldens/nine-dragon-stack/`) | before (the goldens' own SHARDFILE frames, `033398c5c6`) |
  after (`3cadfddf16`), Chromium.
- **NR8: sheet at `3cadfddf16`**, [12-nr8](../../../art/nine-dragon-stack/round-32-shardfile-regressions/12-nr8-sheet.jpg):
  CO6 A-D plus five views (A back, A down 55 deg, A up 38 deg, C back, B back), LEGACY | SHARDFILE on Chromium and
  WebKit, 36 captures, 0 page errors. Hands, floor, stairs, sky and reflections match. **Still off:** B's haze and wall
  pallor (SHARDFILE deeper navy, NR3 facade half); A down shows no red jian tassel over the blade and the left rail's
  carved gold panel is plain stone (NR7 / NR3). Re-run the sheet once those land.
- **NR8 golden sheet (G858) at `f43f3adba3`**, [15-nr8](../../../art/nine-dragon-stack/round-32-shardfile-regressions/15-nr8-sheet.jpg):
  the same 9 views, golden (A-D; LEGACY live for the 5 extra views, which have no golden) | SHARDFILE Chromium |
  SHARDFILE WebKit, 0 page errors. Same residuals as above, now with sp-o5's causes: near facade windows brown (the
  nine-windows interior ray misses the glass, `inGlass` 0; NR3 facade half, test pending a quiet tree), wall pallor at
  the top of 'back', and the look-down tassel (needs a runtime view-gravity input to the cloth sway, M). New: I (B back),
  the big gold sign draws dim grey on Chromium but bright on WebKit (one frame each; animation phase not ruled out).
  NR4's golden board: [14-nr4](../../../art/nine-dragon-stack/round-32-shardfile-regressions/14-nr4-board.jpg).
- **Wall pallor: done** `8ee92dd4a3` (fix(tiles): rebuild programs after a placeholder). The facade shell's non-instanced
  program was built against `RefiningWholeLibrary`'s channel-less placeholder (a vertex shader with no inputs), so the
  shell drew collapsed and the silk fog behind it read as pale walls; the first fine union now rebuilds the mesh's
  programs. Board [16-pallor](../../../art/nine-dragon-stack/round-32-shardfile-regressions/16-pallor-board.jpg)
  (golden A-D, LEGACY live E / H, before / after on Chromium and WebKit).
- **B-back gold sign: not a regression.** Three runs at `a0ea22591f` (two live 7.5 s series at 4 frames a second, and the
  nine-view capture) hold it steady and bright in both modes (luma 179 LEGACY, 172-173 SHARDFILE). The earlier dim
  frames were Chromium-only and in LEGACY too: a capture-timing artifact, not SHARDFILE.
- **NR6 rain: done, no rain change.** At `ded7bfb272`, camera B, 8 frames each way on Chromium and WebKit: the strokes
  match (frame-to-frame stroke contrast 24.5 / 24.9 LEGACY, 25.9 / 25.8 SHARDFILE; same length, angle and density). The
  drizzle reads stronger only because the street behind it is darker and has no haze (background luma 91 LEGACY,
  69 SHARDFILE), so more faint tails show: that is B's haze (NR3), not the rain. Board
  [17-nr6](../../../art/nine-dragon-stack/round-32-shardfile-regressions/17-nr6-board.jpg).

## Order

NR1 first (Jake's headline, one small fix) → NR2 bisect (it may fix the wall pallor in NR3) → NR3 → NR4 → NR5 → NR6, NR7 → NR8. NR4 runs
in parallel on a Codex lane. Nothing here waits on Jake.

## Questions for Jake

None. Every fix restores the LEGACY look he already approved.

## Capture notes

- Captures: muted Chromium (`--use-angle=metal`) and WebKit, on the shared `4990c215fb` preview, entered through SHARD
  SELECT's LEGACY and SHARDFILE buttons (Developer + the Legacy shard buttons row, as CO6). Zero page errors either way.
- The scratch scripts were deleted, so NR2 rebuilds its own probe. Pose: `window.__wildshard.pose` with harness pins.
  Hook test: wrap the hull material's `onBeforeRender` and count calls. Attributes: walk `scene` for each mesh's
  geometry attribute names.
