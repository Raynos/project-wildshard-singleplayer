# Art-style freedom in the shardfile: can authors make new looks? (read-only research, 2026-10-04)

Jake's test: if the engine only had Driftwood toon and Pine Hollow PBR, could an author make Nalati, Nine Dragon,
Signal Dunes or Sky Reach? Do the shard ideas in the vision docs fit the shardfile? Short answer: **with today's four
families alone, no. The plan's direction (families, then graphs, then shader code, G4) is right and matches what you
remember, but the graphs were moved to Part B, which comes after the format freezes. That ordering is the bug.**

## 1. What the sources say

| Source | What it says about custom styles / shaders / TSL |
|---|---|
| VISION.md | Brief: *"never accept … unrestricted shader programs."* Art direction: one coherent language, but the repo now has four looks; open tension "one engine, several look stacks". Tension row: *"material graphs are validated data"* (Jake, 10-03) |
| MMO-REQUIREMENTS | **R5** MUST: *"Each shard keeps its own look (toon, PBR, painterly, Jiehua Neon and the newer ones)."* **W7f** MUST: *"A shard's style lives in its materials and a colour grade chosen per pixel, never in a full-screen pass of its own."* **P2**: a GPU-hanging shader must not ruin a shard. **O7**: superseded by G4 / G32. Decision 3 lists "look stacks, material graphs" among the approved systems |
| SHARD-PLATFORM-PLAN §6.2 (design) | *"Material graphs. three.js **TSL node materials** stored as a JSON graph … The validator allows only approved node types and caps node count, texture samples and an estimated cost; the engine compiles the graph to WGSL / GLSL. Authors never write shader code. Covers water, glowing runes, dissolves, vertex wind, caustics, heat haze."* Look stacks: tone map, toon ramp, painterly filter, outlines, bloom, fog, grade, grain |
| SHARD-PLATFORM **G4** | *"Material families, then material graphs, then restricted shader code: v1 ships rich parameterised families; validated, cost-capped graphs follow as the creative path; a validated, cost-checked shading-language subset comes after"* |
| **G32** | *"A renderer-neutral shardfile … families, graphs and later shader code compile per renderer; WebGL is the v1 renderer … a switch needs no shard changes"* |
| **G75 / G122** | Each shard keeps its full grade at a crossroads; road and strips neutral grey-blue; per-shard before/after boards, then the one-frame row turns on |
| **G146** | Shardfile = data or AssemblyScript; *"a DSL is welcome if it compiles to data or WASM"*; `runtime/` (≤ 20 %) is the temporary hack |
| SF10a / SF10b | Done: four families, renderer-neutral params, precompiled; look v0 = sky / fog / day keys + a 33³ LUT |
| SF19a / SF19b | One frame landed default-off: camera owns sun / sky / fog / exposure; each pixel's region slot goes in colour alpha (≤ 16 slots); grade per slot |
| **Part B S5 (SF35)** | *"Material graphs, then restricted shader code, compiled per renderer (G4 stages 2–3)"*. **S6 (SF37)**: WebGPU spike |
| Git `c9faac1fb` (Jake, 10-03) | **This is the TSL talk you remember**: *"SP18 material graphs: a validated node graph (allowlisted nodes, cost cap) compiled by our own compiler to two targets: the WebGL renderer's shader patches … and TSL for WebGPURenderer, so every effect moved to a graph is already WebGPU-ready; first targets: sand ripple, facade windows, water, wind sway, the dune shadow."* The E435 rewrite moved it to Part B |
| E435 plan-audit-claude | *"Material graphs with our own dual-target compiler is a product in itself. Start with parameterised presets and a LUT; add graphs when a preset can't express a real request."* Also: *"A graph catalogue on its own forces the engine team to pre-build every mechanic (Roblox's pre-Luau problem)"*; *"shader cost caps don't prevent GPU hangs or context loss on iOS"* |
| E435 streaming-claude | *"Materials as parameters over the engine's fixed shader set … No shard-authored shader code"*: a fixed program set means 0 links at the crossroads |
| E435 streaming-codex | A **versioned look contract**; validation must charge shader variants and overdraw |
| SHARD-IDEAS.md | §3 showcases are *"built from … look stacks, material graphs"*: Clockwork Tide *"watercolour look stack with a caustics material graph"*; Ashfall *"heat-haze material graph"*; Skyforge *"cloud-scatter material"* |

## 2. What the code does today

- `src/engine/render/families/params.ts`: valibot schemas; `FAMILY_IDS = ['toon','pbr','painterly','emissive']`.
  `src/game/shardfile/materials.ts`: *"Authored material IDs select bounded platform family parameters, never shader
  source"*; ≤ 256 materials. `schema.ts` `look` = families, materials, familyLooks, grade {exposure, saturation,
  contrast, lut}, day keys. **No programs / GPU-cost budget** in `budget.ts`, no post-effect section.
- The families are GLSL injected through `patchShader` into three's built-in materials (`toon.ts`: *"redefines
  RE_Direct / RE_IndirectDiffuse"*). Not TSL.
- **The tell: every new shard has grown the families with a one-shard layer written by the engine.** The PBR `ground`
  layer (~30 parameters) is Signal Dunes' sand; `measure` is Template 1's dev map; the emissive `tube` is Nine Dragon's
  neon and `sky` is Signal Dunes' dome. That is "every art style is engine work", which no outside author can do.
- Existing shards stay alive through `runtime/`: the WebGPU inventory counts **96 shader patches, 115 ShaderMaterials
  in 69 files, 20 global ShaderChunk edits, 19 postprocessing files**; 98 shard files use `patchShader` /
  `ShaderMaterial` (Driftwood 22 rows, Sky Reach 31, Nalati 23, Pine 25, Signal Dunes 15, Nine Dragon 21). Nine
  Dragon has its own full-screen passes (`render/jiehua.ts`, `bleed.ts`, `haze.ts`, `reflect.ts`), which W7f forbids.

## 3. three.js TSL (repo: `three` ^0.186.0, installed 0.186.0)

- **What it expresses:** a full shading language in JS: `Fn`, `If`, `Loop(count)`, `select`, maths, swizzles,
  `texture`, `triplanarTexture`, attributes, instance index, `time`, `positionLocal/World`, `normalWorld`, view
  direction, vertex displacement (`positionNode`), `colorNode`, `normalNode`, `emissiveNode`, `outputNode`, custom
  `LightingModel`s, viewport depth / colour textures (refraction, heat haze), `ToonOutlinePassNode`, MaterialX noise
  (`mx_noise_*`, `mx_fractal_noise_*`, `mx_worley_noise_*`, `mx_cell_noise_*`).
- **Two targets:** `WebGPURenderer` emits WGSL on WebGPU and GLSL ES 3 on its WebGL2 backend (`forceWebGL`).
  **New and important: r186 also renders TSL inside today's `WebGLRenderer`**: `renderer.setNodesHandler(new
  WebGLNodesHandler())` (`three/examples/jsm/tsl/WebGLNodesHandler.js`, 595 lines, *"to prepare for migration to
  WebGPURenderer"*). Node materials then sit next to our patched materials, ShaderMaterials and pmndrs `postprocessing`.
  Its stated limits: no VSM shadows, MRT, transmission, WebGPU post stack or storage textures; fog / environment don't
  update automatically; *"instanced mesh geometry cannot be shared"* (this matters for E271 instancing). The repo
  docs (`ENGINE.md`, engine-fit-v2 §4) still say *"No TSL until a switch: it runs only under WebGPURenderer"*. In r186
  that is out of date. **One TSL target could serve WebGL now and WebGPU later.** It needs a spike on the phone first.
- **From JSON, safely?** three's `NodeLoader` builds any registered node class by type name, and `CodeNode` /
  `ExpressionNode` / `FunctionNode` (`wgslFn`, `glslFn`) carry raw source, so it is **not safe as-is**. three's
  `MaterialXLoader` (3.4k lines, ~200 standard nodes mapped to TSL) shows the safe pattern: **a declarative graph
  over a fixed vocabulary, mapped by our own code to TSL calls, with no code nodes.** Our IR should do the same.
- **Cost-bounded?** Yes, if we own the IR: a DAG with no cycles, node count, sampler count (fragment and vertex), loops
  only with a constant count ≤ N, safe maths (clamped pow / log / div), plus counting the generated GLSL / WGSL at
  validate. Caveats: iOS Safari has no GPU timer queries, so the runtime guard is frame time, and a context-loss
  recovery path is still owed (audit item 8). A bounded straight-line shader cannot hang the GPU. Overdraw is charged
  separately.
- **Repo use:** none. `src/gpu/` (E52 TSL ports of Driftwood: toon, ocean, sky, post) was deleted by E184 (`f9383ce48`).
  Recoverable from git as reference.

## 4. Every idea against the tiers

Tiers: **(a)** today's 4 families + parameters + grade / LUT / fog / sky keys; **(b)** material-graph IR as data on
TSL from an approved node set, **plus a per-shard post list from an engine catalogue** (the same safety idea applied to
post); **(c)** restricted shader text. "Engine" = a platform system that no shader tier replaces.

| # | Idea (source) | Look and render needs | (a) | (b) | (c) | Also needs (engine) | Min |
|---|---|---|---|---|---|---|---|
| E1 | Template 1 (dev map) | role colours, 1 m grid, size labels | yes, via the bespoke `measure` layer | yes | – | – | a* |
| E2 | Template 2 (Blender) | families on authored GLB | yes | – | – | – | a |
| E3 | Driftwood (faceted toon) | toon ramp yes; ocean waves + foam, palm / pennant / seabed sway, waterfall, caustics, stylised sky | surfaces only | yes (vertex offset, noise, time) | – | ocean volume, gulls (particles) | b |
| E4 | Pine Hollow (PBR) | PBR yes; needle / twig wind sway, moss blend, far-tree cards, stream fog | surfaces only | yes | – | N8AO (engine), weather FX | b |
| E5 | Nalati (painterly) | cel bands, painted shade, warm terminator, in-material grade, sway; grass field, cloud sea, painted sky, global air / fog edits | only because painterly *is* Nalati | yes (painterly = ~30 nodes on N·L) | – | grass system, cloud sea, weather | b |
| E6 | Signal Dunes (Last Light) | ripples, grain, crest band, baked key shadow, afterglow dome, firelight | only via the one-shard `ground` / `sky` layers | yes (the general form of those layers) | – | fire / storm particles | b (a*) |
| E7 | Sky Reach (Gilded Air) | painted light (warm bounce, rim, shade floor on *every* material), cloud sea, puffs, sun glow, ray wake | approx. via painterly | yes, **with a lighting-model stage** | nicer | cloud sea, particles | b |
| E8 | Nine Dragon (Jiehua Neon) | ruled ink lines, ink bleed into silk, SDF neon (in family), wet streaks, baked light pools, SSR, shaft mist | neon only | materials yes; the lines / bleed need **catalogue post effects** | bleed shape maybe | SSR, light-pool volumes, mist (engine) | b + post |
| 1 | Underways (§2.1) | lantern-only light, dark grade, wet walls | yes | wet walls | – | **many local lights under a budget**, occlusion, light volumes | a |
| 2 | Junction Town (§2.2) | frontier town, dust; no stated look | yes | heat shimmer | – | vehicles, horizon impostors | a |
| 3 | Stormglass Peaks (§2.3) | snow deformation, blizzards, ice, wind | part | yes (snow / ice, trail-mask input) | – | deformation RT, weather director, fog density, particles | b |
| 4 | Drowned Archive (§2.4) | caustics on any surface, light shafts, underwater fog | toon caustics only | yes | – | **underwater medium** (absorption, god rays), water volumes | b |
| 5 | Hearthvale (§2.5) | a village; no stated look | yes | – | – | crowds, animation instancing | a |
| 6 | Clockwork Tide (§3.1) | *watercolour look stack + caustics material graph*, tide water level | no | yes: paper grain, wobble, edge darkening in-material + catalogue paper / edge effects | full pigment sim | animated water body | b + post |
| 7 | Skyforge Regatta (§3.2) | *toon + cloud-scatter material*, wind lanes | toon yes | clouds yes | – | wind ribbons (particles) | b |
| 8 | Ashfall Bastion (§3.3) | *heat-haze graph + ash LUT*, flowing lava | LUT only | yes (scene-colour distort node, flow UV) | – | ash particles | b |
| 9 | Lantern Night Market (§3.4) | *neon look + bloom + night LUT*, lanterns, fireworks | yes (emissive + LUT) | – | – | bloom params, fireworks (particles) | a |
| 10 | Shatterworks (§4.1) | voxel world, own mesher | (any) | – | no help | voxel volume device, or self-hosted | engine |
| 11 | Folded Monastery (§4.2) | recursive portals, stencil | (any) | – | no help | portal rendering, or self-hosted | engine |
| 12 | Alchemy Pit (§4.3) | GPU falling-sand CA | (any) | – | compute, beyond scope | GPU sim, or self-hosted | engine |
| 13 | Pocket shards (§5.1) | none (portal swap); cut by E435 | n/a | | | portal transition | n/a |
| 14 | Seams talk (§5.2) | weather / rivers across edges | n/a | | | frame-owned weather blend | n/a |
| 15 | Shard law (§5.3) | none | n/a | | | | n/a |
| 16 | Living shards (§5.4) | decay, ruins, regrowth | part | yes: **graph params bound to shard state** (age → moss) | – | shared world state | b |
| 17 | Feedback loop (§5.5) | none (frame-time telemetry) | n/a | | | | n/a |

Also from VISION: biomes (desert, snow, forest, wetland, volcanic, crystal badlands) and the glowing lattice. Crystal
iridescence and sparkle are (b); the lattice is engine-owned emissive (a).

**The counts.** The "17" are 12 shard ideas plus 5 concept expansions. Only 4 of the 17 state an art direction (§3),
and 4 have no visual demand at all (13, 14, 15, 17). Of the 12 shard ideas plus #16:
- **Fit (a) alone: 4** (Underways, Junction Town, Hearthvale, Night Market), each still needs engine systems.
- **Need (b): 6** (Stormglass, Drowned Archive, Clockwork Tide, Skyforge, Ashfall, Living shards). Two of them,
  Clockwork Tide and Ashfall, *were specified as material graphs* in the ideas doc.
- **Need (c): 0 strictly.** (c) adds expressiveness and author comfort (a full watercolour pigment model, a bespoke
  ink bleed), not a capability no bounded graph has.
- **No shader tier rescues 3** (Shatterworks, Folded Monastery, Alchemy Pit). The ideas doc already sends them to
  self-hosting or graduation.

Of the 7 existing shards: 2 fit (a) cleanly, 1 fits only through a layer the engine wrote for it, and 4 need (b)
(Nine Dragon also needs catalogue post).

**Your thought experiment**, with only toon + PBR in (a): **none of Nalati, Nine Dragon, Signal Dunes or Sky Reach
can be made**. With (b) plus a lighting-model stage and a post catalogue: **all four can**, minus engine systems (cloud
sea, SSR, light pools) that would be graduated devices.

## 5. Recommended long-term architecture (built up front)

**Principle.** The IR is the format, and families are built-in presets of it. Shader text, when it comes, is a
compiler front-end on the author's machine that emits the IR. The shardfile only ever carries data, which is G146.
A WebGPU switch changes only the engine's IR→TSL back-end (G32).

### 5.1 In the shardfile before SHARDFILE_VERSION 1 freezes (SF22c)
1. **`look.materials[id]` gains `{ family: "graph", graph: <file hash>, params, textures, fallback: <preset id> }`**
   beside the four presets. The presets stay as they are. Their parameter schemas are their public interface; later
   they can be re-implemented as graphs with no format change. **Freeze the rule: no more shard-specific layers on the
   families.** A new need is a graph, or a graduated preset the platform owns.
2. **The graph file kind `graph@1`**: a typed DAG over a versioned vocabulary (`requires: ["graph@1"]`). It borrows
   names from the MaterialX standard library (stable and documented; three already maps it to TSL) plus Wildshard
   inputs (time, shard clock, sun dir, wind field, water level, frame air). Output stages are `vertex.offset`,
   `surface` (albedo, normal, roughness, metal, emissive, alpha, cutoff) and an optional **`lighting`** stage: a
   sub-graph per light from N·L, shadow, light colour, view and half. This is what makes Sky Reach, Nalati and
   Driftwood expressible. No code nodes. Loops only with a constant count.
3. **Parameter bindings as data**: a graph uniform may bind to a day-key channel or a declared public numeric state
   field (tide level, age, alarm). This removes the "runtime adapter" TypeScript that feeds Signal Dunes' dusk today.
4. **`look.post`: an ordered list from an engine effect catalogue** (`post@1`: ink outline, cel posterize, dither /
   halftone, paper grain, edge darkening, bloom threshold / tint, vignette, split tone, LUT, scanline). The engine
   evaluates all of them in its one combined pass, gated per pixel by the frame slot that SF19a already writes. A
   neighbour's pixels get its full list only within budget, otherwise grade only. **Amend W7f's wording** from "never
   a full-screen pass of its own" to "engine-catalogue effects with per-shard parameters, gated per pixel; never a
   shard-owned pass".
5. **`budgets.gpu`**, declared and measured: programs per shard (≈ 16–24), nodes per graph (≈ 256), fragment samplers
   (≈ 8), vertex samplers (≈ 2), loop product (≈ 64), estimated ALU class, post cost points at 2× render scale, and
   transparent overdraw. Validate compiles each graph to GLSL (and WGSL once WebGPU exists) and counts instructions.
   Admission charges a shard's programs to the crossroads' link budget (`linkMs`).

### 5.2 Part A vs later
- **Part A (move from S5):** a spike of `WebGLNodesHandler` (a node material beside patched ones, with the engine's
  fog, CSM, the slot write, instancing and precompile, Simulator + one iPhone reading, default-off Debug row). Then
  the format items 1–5, the validator and the cost estimator, an IR→TSL compiler with about 60 starter nodes and the
  lighting stage, post catalogue v1 (outline, posterize, dither / grain, paper, bloom params), and precompile at
  readiness distance (SF18d gives ~435 m of lead). Acceptance is SP18's original targets ported to graphs (sand
  ripple, facade windows, wind sway, water), and Nalati's painterly rebuilt as a graph on a board. **Fallback if the
  spike fails:** IR→GLSL through `patchShader` (your 10-03 Q2 pick), with TSL added at the WebGPU switch. The format
  is unchanged either way.
- **Later (Part B):** the full node set, the text front-end (a TSL-like subset in `wildshard build`, type-checked,
  compiled to `graph@1`; this is G4's "restricted shader code" without shipping code), particle and sky graphs,
  porting the 96 patches and 115 ShaderMaterials out of `runtime/` (90/10 → 100/0), the WebGPU switch (S6), and
  compute only for graduated devices.

### 5.3 Safety, one frame, the phone
- **Safety:** our own IR, not `NodeLoader`. Strict valibot schema, type-checked DAG, an allowlisted vocabulary,
  constant loops, safe maths, admitted textures only, uniform ranges. The engine appends the fog / slot / grade
  epilogue, and a graph cannot skip it. Runtime guard: if a shard holds frame time over budget, its graphs drop to
  their `fallback` preset (the auto-degrade tier). Owed: context-loss recovery.
- **One frame (G75):** graphs are materials, so per-pixel identity and the per-shard grade carry over unchanged. A
  lighting stage reads the frame's one sun and air, never its own. Post effects are keyed by slot (≤ 16).
- **Phone:** WebGL2 now (TSL → GLSL in `WebGLRenderer`), WebGPU later with no shard change. At 2× render scale a
  full-screen effect costs 4× the pixels, so the catalogue is a single uber-pass with cost points. Program count is
  the iOS hitch risk, so budget it and precompile before the edge.

### 5.4 Effort (agent-days, same unit as the plan)
| Part A item | Days |
|---|---|
| WebGLNodesHandler spike + phone reading | 2–4 |
| Format items 1–5 + validator + cost estimator + SHARDFILE.md | 5–7 |
| IR→TSL compiler, ~60 nodes + lighting stage, contract tests | 9–13 |
| Post catalogue v1, slot-gated in the one-frame pass | 5–8 |
| Precompile at readiness + programs admission | 2–3 |
| Acceptance ports (4 effects + Nalati board) | 4–6 |
| **Total** | **≈ 27–41** (≈ +8–11 % on Part A's 362; fallback compiler +5–8) |

Later: text front-end 10–15, full vocabulary 6–10, particle / sky graphs 6–10, the WebGPU switch separately (large).

## 6. Verdict

- **(a) alone: no.** 4 of 12 shard ideas, and of the existing seven only the templates (plus Signal Dunes through a
  bespoke layer). Your toon + PBR thought experiment fails on all four style shards.
- **(a) + (b), with a lighting stage and a post catalogue: yes for 9 of 12** and for all 7 existing shards' materials.
  **(c) is needed by none.** Build it later as a text front-end that compiles to the IR. **3 need engine systems or
  self-hosting**, which the ideas doc already says.
- **Not fundamentally broken; mis-ordered.** G4 / G32 / R5 and Jake's 10-03 SP18 decision are the right design. The
  break is that graphs sit in Part B (S5) while SHARDFILE_VERSION 1 freezes in Part A, that SF10a keeps adding
  one-shard layers to the families, and that W7f's wording bans per-shard post styles. **Fixable by moving the format
  work (5.1) and a minimal compiler + post catalogue into Part A before the freeze: ≈ 27–41 agent-days.**
