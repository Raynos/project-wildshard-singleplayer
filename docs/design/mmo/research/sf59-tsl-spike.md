# SF59 step 1: the TSL spike (G156)

**State (2026-10-04):** bench built and linted; **measurements not yet run** (the coordinator's frame-floor quiet window
forbids browsers and builds; the three commands below run after it). Everything here except §3's table comes from
reading three r186 (`node_modules/three`, 0.186.0) against the engine's render setup. The verdict in §5 is provisional
and turns final on the pre-registered thresholds in §5, with no further judgement needed.

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

2,500 instances × 64 B = 160 KB is past every device's uniform-block limit (16–64 KB), so TSL takes its
instanced-attribute path, the one the engine's large pools would take. The size-label glyphs of the measure layer are
not ported (they need integer bit ops and a constant loop; TSL has both). The bench uses `InstancedMesh` only: no
`BatchedMesh` and no multi-draw (E271 / E272). `scripts/test-facade-instancing.mjs` covers the game, which the spike
does not touch; it is run with the measurements.

Run, after the quiet window:

```
scripts/browser-lane.sh node scripts/tsl-spike/run.mjs
scripts/sim-lane.sh run --max 20 frame-floor-iphone-17-pro node scripts/tsl-spike/run.mjs --surface=sim
node scripts/tsl-spike/run.mjs --bundle
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
9. **Safety is ours either way.** `NodeLoader` builds any registered node by name, and `CodeNode` / `glslFn` carry raw
   source. The IR stays our own allowlisted vocabulary, mapped to TSL calls by our code (the `MaterialXLoader` pattern).

What works by construction, to be confirmed by the run: node and patched materials in one frame (the handler hooks
per material), instancing (`instanceMatrix` → interleaved attributes past the uniform limit), three's lights and PCF
shadow maps received in the graph, uniforms shared with engine objects (`reference('value', type, fogUniforms.x)`),
`time` and `instanceIndex` in the vertex stage.

## 3. Measurements (pending the run)

| | desktop family | desktop tsl | sim family | sim tsl | sim tsl-post |
|---|---|---|---|---|---|
| compile + first-draw stall (ms) | – | – | – | – | – |
| node build (JS, ms) | – | – | – | – | – |
| programs / GLSL bytes (box program) | – | – | – | – | – |
| rAF median / p95 (ms) | – | – | – | – | – |
| CPU per frame (ms) | – | – | – | – | – |
| parity vs family (PSNR, % px > 8) | – | – | – | – | – |
| bundle added (gzip) | – | – | – | – | – |

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

## 5. Verdict (provisional) and the rule that finalises it

**Provisional: TSL is viable as the compiler target, conditional on the run.** Nothing in r186 blocks node materials
inside `WebGLRenderer` beside patched ones, with instancing. The costs are fixable and the engine owns them: items 1–5
in §2, roughly the 2–4 days the research estimate gave the spike, plus porting the shadow-filter, shadow-fade and
sky-light chunk edits to nodes. The shader-patch target carries none of those costs. It would, though, need its own
GLSL emitter and a second back-end at the WebGPU switch.

**Pre-registered thresholds** (all must hold on the Simulator phone tier; otherwise the compiler targets shader patches):

1. parity `family` vs `tsl` ≥ 40 dB PSNR, under 1 % of pixels off by > 8;
2. `tsl` rAF median within 5 % of `family`, and p95 ≤ 35 ms (the floor's limit);
3. `tsl` compile + first-draw stall ≤ 2× `family`'s, or ≤ 50 ms more;
4. `--bundle`: the spike's imports add ≤ 150 KB gzip;
5. no GL errors; instancing, shadows and fog render (contact sheet), and `tsl-post` holds the floor.
