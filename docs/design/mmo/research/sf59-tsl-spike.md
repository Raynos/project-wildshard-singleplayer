# SF59 step 1: the TSL spike (G156)

**State (2026-10-04): measured; final verdict: TSL is the compiler target** (§5: all five pre-registered thresholds
hold on the iOS Simulator). The run found one more engine-side defect (§2.10). One signal sits outside the thresholds:
the Simulator's GPU-synced frame time, flagged in §5. §2 comes from reading three r186 (`node_modules/three`, 0.186.0)
against the engine's render setup; §3 is the run.

**Question (SHARD-PLATFORM SF59, G156):** can three r186's TSL node materials run inside today's `WebGLRenderer`
(`WebGLNodesHandler`) beside the engine's patched family materials, instanced, at the frame floor on the phone tier? If
yes, the graph format compiles to TSL; if no, it compiles to the families' WebGL shader patches (Jake's 10-03 fallback,
+5–8 days, no format change).

## 1. The bench (default-off, isolated, deletable)

`scripts/tsl-spike/` (`index.html`, `spike.js`, `run.mjs`). It is a measurement tool, not game code: nothing in `src/`
imports it, there is no Debug row or URL switch in the game, and deleting the folder removes it. It mirrors `Game.ts`'s
frame: `NoToneMapping`, sRGB output, PCF shadows (2048), the scene drawn into a half-float target, then a screen pass,
at render scale 2× in the iPhone 16 Pro viewport. It uses the engine's own `compilePbr` and `installAtmosphere` (the
height-fog ShaderChunk edits), so the hand-written side is the real family.

| Variant | Draws |
|---|---|
| `family` | 2,500 instanced boxes plus the ground, all PBR family + SF56 measure layer (`compilePbr`), GLSL screen pass |
| `tsl` | the boxes as a TSL `MeshStandardNodeMaterial` re-expressing the measure layer (role decode, 1 m grid, sub-grid, glow); the ground stays the family (**both kinds in one frame**); the engine height fog as a TSL epilogue reading `fogUniforms` by reference; GLSL screen pass |
| `tsl-raw` | as `tsl` through the stock handler (no output fix), to measure the colour-space defect (§2.1) |
| `tsl-post` | as `tsl`, the screen pass a **TSL node graph** (exposure, saturation, lift/gain, filmic, vignette) on a fullscreen quad |
| `tsl-sway` | as `tsl-post` plus a **vertex-offset stage** (per-instance wind sway from `instanceIndex`, `time`) |
| `plain` / `tsl-plain` | diagnostic pair (added in the run): the boxes as a stock `MeshStandardMaterial` vs a stock `MeshStandardNodeMaterial` with the fog epilogue, no measure layer: TSL's own lighting and shadow path apart from the ported graph |

**Stall protocol (added in the run).** WebKit and Metal cache compiled programs by source, across Safari launches and
Simulator boots. So the first runs measured cache state, not compile cost: a program seen before cost 25–45 ms and a
new one about 250 ms. Each page now writes a per-page constant into the one program that differs between variants (the
boxes, and the TSL post graph), so that program always compiles cold. A discarded `warmup` page runs first and warms the
shared programs (ground, shadow depth, GLSL post) for every variant.

2,500 instances × 64 B = 160 KB is past every device's uniform-block limit (16–64 KB), so TSL takes its
instanced-attribute path, the one the engine's large pools would take. The size-label glyphs of the measure layer are
not ported (they need integer bit ops and a constant loop; TSL has both). The bench uses `InstancedMesh` only: no
`BatchedMesh` and no multi-draw (E271 / E272). `scripts/test-facade-instancing.mjs` covers the game, which the spike
does not touch; it is run with the measurements.

Run (the sim and bundle forms open no headless browser, so they take `SKIP_BROWSER_LANE=1`):

```
scripts/browser-lane.sh node scripts/tsl-spike/run.mjs
SKIP_BROWSER_LANE=1 scripts/sim-lane.sh run --max 20 frame-floor-iphone-17-pro node scripts/tsl-spike/run.mjs --surface=sim
SKIP_BROWSER_LANE=1 node scripts/tsl-spike/run.mjs --bundle
```

Each writes `progress/shard-platform/sf59/tsl-spike-<surface>.json` (compile stall, node-build ms, programs and
GLSL bytes per program, rAF median / p95, CPU ms per frame, draw calls, `renderer.info.memory`, JS heap, GL errors,
pixel parity between variants) and a contact sheet; `--bundle` writes the minified + gzip bytes a production build
adds for the spike's imports and for the whole `three/webgpu` + `three/tsl` namespaces.

## 2. What the source reading already shows

The handler is real and small (595 lines). It proxies the renderer into a `GLSLNodeBuilder`, compiles node materials to
a `RawShaderMaterial`-style GLSL 3 program and feeds three's own lights and shadow maps into the node graph. It does
**not** make TSL a drop-in for this engine; a TSL back-end owes these engine-side fixes (the bench carries 1 and 2):

1. **Output transform defect in render targets.** The stock handler always applies the renderer's tone mapping and
   `outputColorSpace`. Classic materials skip both inside a render target. The engine draws every scene into a
   half-float target with `outputColorSpace = sRGB` (Game.ts), so a stock node material would be **sRGB-encoded twice**.
   Fix: an `EngineNodesHandler` subclass that follows the bound target and keys the program cache on it (spike.js);
   `tsl-raw` vs `tsl` measures the size of the error.
2. **None of the engine's ShaderChunk edits reach node materials.** Height fog (`Atmosphere.ts`), the tent PCF filter
   (`shadowFilter.ts`), shadow fade (`shadowFade.ts`), the sky rig's light block (`skyRig.ts`) and `pointLightSkip.ts`
   all edit `THREE.ShaderChunk`; TSL never reads it. Each must be re-expressed as nodes and appended by the engine (the
   "epilogue" art-style-expressiveness §5.3 already calls for). The spike re-expresses the fog. Classic three fogs
   *after* tone mapping and colour space (`fog_fragment` follows `colorspace_fragment`), and TSL fogs before, so the
   epilogue hooks the handler's output callback. Shadows from the handler use three's stock PCF lookup: parity with the
   tent filter and the fade is owed.
3. **The frame counter.** `onBeforeRender` increments `renderer.info.render.frame` once per node-material draw. The
   engine reads that as a frame counter: `memorySaver.ts` (release timing) and Nalati's grass `place()` (once per
   frame). With node materials on screen both would run per draw. Fix: count frames in the engine.
4. **Instanced geometry cannot be shared.** The handler writes its instancing attributes into the geometry and disposes
   it on every program build. A TSL `InstancedMesh` needs its own `BufferGeometry` (a shallow one holding the same
   attribute objects shares the GPU buffers, as spike.js does). Each rebuild re-binds VAOs, and under the Memory saver a
   released attribute is read back from the GPU.
5. **Vertex offsets do not reach shadows.** `WebGLShadowMap` draws casters with classic depth materials, so a graph's
   `vertex.offset` stage moves the mesh but not its shadow unless the back-end also emits a depth variant.
6. **Fog and environment changes need `dispose()`** to recompile. Day-key bindings must therefore be uniforms, never
   graph structure, which is the format's rule anyway.
7. **Not available on this path:** VSM shadows, MRT, transmission, storage textures and the WebGPU post stack. A post
   graph is a node material on a fullscreen quad, in its own pass (`tsl-post`). It cannot be a pmndrs `Effect`, which
   is a GLSL fragment, so it costs a full-screen pass at 2× render scale.
8. **Bundle.** The handler imports `three/webgpu` (`build/three.webgpu.js`, 2.28 MB unminified, one flat module)
   beside `three` (both share `three.core.js`). The tree-shaken delta is the open number; `--bundle` measures it.
10. **Render-target samples are flipped** (found by the run). Under the GLSL builder `TextureNode` flips every
   `isRenderTargetTexture` sample, because WebGPURenderer's WebGL backend stores targets upside down. The classic
   `WebGLRenderer` stores them upright, so a post graph reading the engine's target draws the frame upside down. Fix:
   the back-end cancels the flip on every target it binds to a graph (spike.js does it in the post graph's UV).
9. **Safety is ours either way.** `NodeLoader` builds any registered node by name, and `CodeNode` / `glslFn` carry raw
   source. The IR stays our own allowlisted vocabulary, mapped to TSL calls by our code (the `MaterialXLoader` pattern).

What works by construction, confirmed by the run (§3): node and patched materials in one frame (the handler hooks
per material), instancing (`instanceMatrix` → interleaved attributes past the uniform limit), three's lights and PCF
shadow maps received in the graph, uniforms shared with engine objects (`reference('value', type, fogUniforms.x)`),
`time` and `instanceIndex` in the vertex stage.

## 3. Measurements (2026-10-04, HEAD `0af5f676a`+)

**Surfaces.** Desktop: headless Chromium on Metal (ANGLE), the "iPhone 16 Pro" descriptor, render scale 2× (804 × 1362).
Simulator: `frame-floor-iphone-17-pro`, Safari (iOS 26.5 WebKit), 2× (804 × 1428), on a quiet machine (the
coordinator's go). rAF is vsync-capped wherever a frame fits, so beside it the bench times a **synced frame**: the frame
plus a 1-pixel read, which waits for the GPU. Each sample is a batch of 10, because Safari's `performance.now()` has
1 ms resolution; 30 batches per variant. Raw rows: `progress/shard-platform/sf59/tsl-spike-{desktop,sim,bundle}.json`;
contact sheets `tsl-spike-{desktop,sim}.jpg`.

| | sim family | sim tsl | sim tsl-post | sim tsl-sway | sim plain | sim tsl-plain | desktop family | desktop tsl |
|---|---|---|---|---|---|---|---|---|
| stall, box program cold (ms) | 366 | 460 | 406 | 368 | 296 | 414 | 157 | 221 |
| the same, earlier sim run (ms) | 382 | 395 | 376 | 368 | – | – | – | – |
| stall, everything warm (ms; desktop, pre-protocol) | – | – | – | – | – | – | 20.9 | 30.8 |
| node build, JS (ms; builds) | 0 | 23 (1) | 19 (2) | 19 (2) | 0 | 17 (1) | 0 | 13.6 (1) |
| box program VS / FS source (KB) | 20.5 / 84.4 | 3.5 / 21.9 | 3.5 / 21.9 | 3.9 / 21.9 | 19.9 / 79.1 | 3.1 / 18.9 | 20.5 / 84.4 | 3.5 / 21.9 |
| programs after the first frame | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 |
| rAF median / p95 (ms) | 17 / 17 | 17 / 17 | 17 / 17 | 17 / 17 | 17 / 17 | 17 / 17 | 16.7 / 16.7 | 16.7 / 16.8 |
| synced frame median / p95 (ms) | 0.9 / 1.9 | 1.7 / 2.2 | 1.8 / 2.2 | 1.9 / 2.2 | 1.4 / 1.7 | 1.6 / 2.1 | 0.96 / 1.08 | 0.61 / 0.89 |
| the same, earlier sim run (ms) | 1.0 / 1.6 | 1.6 / 1.8 | 1.6 / 2.2 | 1.5 / 2.1 | – | – | – | – |
| parity (PSNR; % px > 8) | – | 72.6 dB; 0 % | 72.5 dB; 0 % | moves | – | 90.9 dB; 0 % vs plain | – | 63.7 dB; 0 % |
| GL / console errors | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

- **The output defect is real** (§2.1). `tsl-raw` (the stock handler) against `family` scores 24.8 dB on the
  Simulator with 55 % of pixels off by > 8, and 26.4 dB / 48 % on desktop (max 30 levels). The engine handler brings it
  to 72.6 dB with a max of 1 level.
- **A post graph matches the GLSL pass.** `tsl-post` against `tsl` is 86.5 dB, max 1 level, once the render-target
  flip is cancelled (§2.10). Before the fix the frame came out upside down.
- **Stall.** A cold TSL box program costs 1.03–1.26× the family's on the Simulator and 1.41× on desktop: +13 to +94 ms,
  of which the JS node build is about 20 ms. TSL's emitted source is a quarter of the family's (21.9 vs 84.4 KB FS).
- **Synced frame.** On desktop the medians swap sign between runs (family 0.59 then 0.96 ms, tsl 0.84 then 0.61), so at
  this scale they are readback noise. On the Simulator `tsl` sat above `family` in both runs (+0.6, +0.8 ms), while the
  stock pair differs by only 0.2 ms (plain 1.4, tsl-plain 1.6). So most of the gap is the ported measure graph, not TSL's
  lighting path. The likely cause is that both grid levels evaluate every `select` branch, where the GLSL branches. The
  Simulator renders on the Mac's GPU, so this is not phone-GPU evidence (ios-simulator skill).
- **Instancing, shadows and fog** render on every variant (contact sheets). The Simulator's taller viewport shows more
  fogged distance, which flatters parity somewhat; `tsl-raw`'s 24.8 dB shows the metric still discriminates.
- **Desktop JS heap:** about +1 to +4 MB with node materials (9.7–10.5 MB family / plain, 10.9–13.8 MB TSL). Safari
  does not report it.

**Bundle** (`--bundle`, vite production build, minified): three's base path is 130.1 KB gzip; **the spike's imports add
117.1 KB gzip** (412 KB minified); all of `three/webgpu` + `three/tsl` would add 255.7 KB gzip.

`scripts/test-facade-instancing.mjs` against a clean HEAD build: **PASS** on desktop, phone tier and iPhone desktop
quality (0 batches, 24,710 instances). It first needed a fix: SF21a's main menu covers the deck's EXPLORE WORLD, so the
test now taps SHARD SELECT first.

## 4. What a graph IR must contain (either target)

Both back-ends consume the same IR, so the format freezes now regardless of the verdict:

- **Stages:** `vertex.offset` (object-space displacement, plus a flag that the back-end must emit a matching shadow /
  depth variant); `surface` (albedo, alpha, alpha cutoff, normal (tangent-space or world), roughness, metalness,
  emissive, occlusion); optional `lighting` (a sub-graph per direct light from N·L, shadow, light colour, view and half
  vectors, plus an indirect term) for toon, painterly and stylised shards. The engine epilogue (fog, the one-frame slot,
  the grade) is appended by the back-end and is not a stage a graph can skip.
- **Node set (starter ≈ 60):** constants and swizzles; arithmetic and safe maths (clamped `pow` / `log` / divide);
  `mix`, `smoothstep`, `step`, `select`, comparison and boolean ops; `floor`, `fract`, `mod`, `abs`, `min`, `max`,
  `clamp`; trig; `dot`, `cross`, `length`, `normalize`; `fwidth` / `dFdx` / `dFdy` (the measure grid needs them);
  the MaterialX noises (`noise`, `fractal`, `worley`, `cell`); `texture` on admitted textures (sampler-counted, with
  `triplanar`); integer ops and a **constant-count loop** (glyphs, octaves).
- **Inputs:** UV sets, vertex colour, position and normal (local, world and geometric), view direction, camera
  position, instance index and a per-instance hash, time, the shard clock, sun direction and colour, the wind field,
  water level, frame air.
- **Bindable params:** typed uniforms (float, vec2/3/4, colour) with ranges, each optionally bound to a day-key channel
  or a declared public numeric shard-state field. Binding changes a value, never the program.
- **Post graphs:** the same IR with a `post` stage over `sceneColour` and `sceneDepth` at screen UV, run as one engine pass
  per shard within the GPU budget.
- **Per-program budget metadata** for the validator: node count, sampler counts per stage, loop product, and the
  emitted GLSL size and instruction count after compile.

## 5. Verdict: TSL is the compiler target

**Final (2026-10-04): the graph format compiles to TSL node materials, run through an engine-owned `WebGLNodesHandler`
subclass inside today's `WebGLRenderer`.** All five pre-registered thresholds hold on the Simulator, so the
shader-patch fallback (Jake's 10-03 pick) is not triggered.

**The thresholds** were registered before the run (all must hold on the Simulator phone tier; otherwise the compiler
targets shader patches):

| # | Threshold | Simulator result | |
|---|---|---|---|
| 1 | parity `family` vs `tsl` ≥ 40 dB PSNR, < 1 % of pixels off by > 8 | 72.6 dB, 0 % (max 1 level) | pass |
| 2 | `tsl` rAF median within 5 % of `family`, p95 ≤ 35 ms | 17 vs 17 ms (0 %), p95 17 ms | pass |
| 3 | `tsl` stall ≤ 2× `family`'s, or ≤ 50 ms more | 1.26× (460 vs 366 ms); earlier run 1.03× | pass |
| 4 | `--bundle`: the spike's imports add ≤ 150 KB gzip | +117.1 KB gzip | pass |
| 5 | no GL errors; instancing, shadows and fog render; `tsl-post` holds the floor | 0 errors; all render; `tsl-post` 17 ms | pass |

**One flag outside the thresholds.** Threshold 2 is met, but rAF hit vsync on both sides, so it says the frame fits
and little about cost. The GPU-synced frame on the Simulator shows the ported measure graph about 0.7 ms (≈ 80 %) over
the hand-written family. Stock TSL lighting costs only about 0.2 ms over the stock material, so the gap is mostly how
the spike emitted the graph. The compiler must therefore emit branch-light code: a `select` evaluates both sides, where
the family's GLSL branches. And per RENDERING.md, the first graph-compiled look ships **default-off behind a Debug row
until a physical-iPhone reading** (frame floor and synced cost against its family) backs it. This is the "GPU budget"
step 4 of SF59 doing its job, not a reason to switch targets.

**Why TSL over shader patches.** The patch target avoids §2's engine fixes. But it needs its own GLSL emitter now and a
second back-end at the WebGPU switch (G32). With TSL, the WebGPU move is a renderer swap, and the node vocabulary,
MaterialX noises, lights and shadows come with three. The fixes are bounded and all of them are engine-side.

### Recommendation

1. **The graph IR is §4, unchanged by the verdict:** our own typed, versioned, allowlisted node vocabulary (≈ 60
   nodes, no code nodes, constant-count loops only) with `vertex.offset`, `surface`, optional `lighting` and `post`
   stages, typed params bindable to day keys and declared shard state, and per-program budget metadata. The shardfile
   carries the IR, never TSL. Our code maps each IR node to a TSL call (the `MaterialXLoader` pattern), so `NodeLoader`,
   `CodeNode` and `glslFn` stay unreachable from content (§2.9).
2. **The target:** TSL through `EngineNodesHandler` on `WebGLRenderer` now, and the same node graph on `WebGPURenderer`
   at the G32 switch. The four families stay hand-written GLSL until each one's graph preset holds parity (SF59's
   done-when), then they are re-expressed as presets.
3. **Engine fixes, in order** (§2; each one lands before the first graph-compiled material ships):
   1. **The output transform (§2.1) and the render-target flip (§2.10)** in `EngineNodesHandler`, with the program
      cache keyed on the bound target. Without them every graph is visibly wrong (24.8 dB, upside-down post).
   2. **The frame counter (§2.3):** the engine counts its own frames before any node material reaches a scene, or the
      Memory saver and Nalati's grass run once per node draw.
   3. **The engine epilogue (§2.2):** height fog (the spike's port), then the tent PCF filter, shadow fade, the sky
      rig's light block and `pointLightSkip` as nodes, appended after the output transform the way the spike does fog.
   4. **Instanced geometry ownership (§2.4)** in the pools: one shallow geometry per node `InstancedMesh`, plus a check
      that the Memory saver's attribute release survives a program rebuild.
   5. **Shadow depth variants for `vertex.offset` (§2.5)** before any swaying graph casts shadows, and day-key params
      as uniforms only (§2.6).
   6. **The validator's budget:** compile each graph, count instructions and samplers, and refuse or fall back to the
      preset. Give it the synced-frame probe from this bench as its cost test.
4. **The bundle:** load `three/webgpu` + `three/tsl` (+117 KB gzip for the spike's surface, up to +256 KB for all of
   it) as a lazy chunk only when a shard with a graph material boots, so shards without one pay nothing.

## 6. Step 2: the engine fixes (2026-10-04)

The bench's TSL variants now run the engine's own back-end instead of the spike's inline handler:
`src/engine/render/graphBackend.ts` (`loadGraphBackend(renderer)`, a lazy `import()` of the node modules, so the
default bundle carries none of `three/webgpu` / `three/tsl`) and `src/engine/render/nodes/`.

- **Fix 1 (§2.1, §2.10):** `EngineNodesHandler` applies the output transform the way classic programs do (tone mapping
  only on screen and only for a `toneMapped` material; the working space inside a target) and keys the program on the
  bound target. `targetTexture()` samples a classic render target upright; three's own shadow lookups keep their flip.
- **Fix 2 (§2.3):** `render/frameCounter.ts`: `renderCount(renderer)` counts `renderer.render()` calls; the Memory
  saver and Nalati's grass read it instead of `renderer.info.render.frame`.
- **Fix 3 (§2.2), first part:** the engine epilogue (`EngineNodesHandler.epilogue`) runs after the output transform.
  Its first stage is the height fog (`nodes/engineFog.ts`, with the chunk's optional edge-haze, fog-bank and weather
  terms); three's stock fog node is dropped wherever the engine fog is installed. The tent PCF (`nodes/tentShadowFilter.ts`)
  is given to every shadow-casting light as its node filter wherever `installShadowFilter()` ran.

Desktop bench (`scripts/browser-lane.sh node scripts/tsl-spike/run.mjs`, the tent at radius 1.5 in every variant):
`family` vs `tsl` 65.4 dB, max 1 level, 0 % > 8; `tsl` vs `tsl-post` (the post graph through `targetTexture`, no hand
flip) 86.8 dB; `plain` vs `tsl-plain` 88.3 dB; the stock handler (`tsl-raw`) 26.9 dB / 52 %; `tsl-pcf` (three's 5-tap
PCF on the node boxes) 59.7 dB with a max of 10 levels, so the metric sees the filter. The engine's render count is
1126 in every variant, three's counter 1689 / 2252 with one / two node materials.

**Still owed before the first graph material ships:** the CSM path. The classic CSM is one DirectionalLight per cascade,
and its chunk gates each one to its depth range; node materials see N full-strength lights. The shadow fade (ghost
lights, `uSunFade`) and the sky rig's CSM light block sit on that path; TSL's physical model already carries the DFG
term the light block re-inserts. `pointLightSkip` is a cost patch with an identical frame, so it needs no parity node;
its node form belongs with the GPU budget work. A level's own fog chunk (fogPatches slots 200 / 300) and Pine Hollow's
wet surfaces (`normal_fragment_begin`) do not reach node materials yet (the handler warns once).
