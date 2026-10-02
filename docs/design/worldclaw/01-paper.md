# 01 · The WorldClaw paper, studied in full

Source: *WorldClaw: Agentic 3D Open-World Generation at Scale*, Chunchao Guo, Jinpeng Li, Yang Li and Zilong Huang,
Tencent Hunyuan. arXiv [2608.05248](https://arxiv.org/abs/2608.05248) v1 (submitted 2026-08-05,
[PDF](https://arxiv.org/pdf/2608.05248), [HTML](https://arxiv.org/html/2608.05248v1)). The PDF has 38 pages: 24 of
text and main figures, 7 of references (111 entries), and 7 pages of extra worlds. Every page, figure and equation was
read for this study (E359, 2026-10-01). The project page's three method figures are the same figures at higher
resolution (`assets/paper/pipeline.jpg` 3400×1687, `terrain-stages.jpg`, `scene-refinement.jpg`; see
[02](02-site-and-repo.md)).

Contributors (§8): project leaders Chunchao Guo and Yang Li; local scene generation Jinpeng Li, Yang Li and Zilong Huang;
global terrain generation Zilong Huang, Yang Li and Jinpeng Li.

## 1. The claim and the one idea

> "a globally coherent world need not be generated everywhere at once."

Coherence comes first: scene semantics, the spatial layout and the terrain are fixed for the whole world. Detail comes
second, and **only in the regions that need it**. The paper calls this coarse-to-fine and global-to-regional.

The introduction sorts prior work into four families and says what each lacks:

| Family | Example | Weakness the paper names |
|---|---|---|
| Procedural (PCG) | Infinigen | limited by the expressiveness of hand-written rules |
| Image / video lifting | Marble (World Labs) | lacks global consistency and geometric fidelity; slow (a house needs a long circling video); unseen views blur |
| Native 3D diffusion | XCube, BlockFusion, LT3SD | content diversity limited by scarce scene datasets |
| Multimodal LLM agents | Holodeck, SceneCraft, SceneSmith | good at planning, but "lack precise 3D spatial control … may overcorrect because of inadequate spatial scale awareness" |

WorldClaw is in the fourth family. It answers the weakness the paper names for it with **two geometric skills**: a
layout-map height field, and camera-ray placement.

## 2. The formal pipeline (§2, Eqs. 1–2)

```
P = F_plan(q)        T = F_terrain(P)        O = F_region(P, T)        S = Compose(T, O)
```

`q` is the prompt, `P` the structured scene specification, `T` the global terrain and `O` the set of placed regional
objects. Agents talk only through **shared structured intermediate representations**: YAML files and images on disk,
never conversation state.

## 3. Stage 1: intent analysis and planning (§2.1)

Two agents. Keeping them separate is the point: it keeps what the user said apart from what the system invented.

1. **Intent analysis agent.** It extracts and normalises only what the prompt states: scene type, theme and visual
   style, key regions and objects, spatial relationships and user preferences. It "neither introduces new scene content
   nor completes unspecified attributes."
2. **Scene planning agent.** It resolves ambiguity and fills every missing attribute against a **predefined
   scene-specification schema**:

   `P = (R, C_terrain, C_object)` (Eq. 3)
   - `R`: the major regions, their attributes and their spatial relationships.
   - `C_terrain`: terrain types, landform characteristics, surface appearance, and terrain-associated assets per
     region.
   - `C_object`: object categories, appearance attributes, approximate densities and region-level spatial
     relationships.
   - The global theme, style, material preferences and atmosphere are shared attributes on those fields.

**The worked example** (Fig. 1). Prompt: "Generate a cartoon-style snowy landscape featuring mountains flanking both
sides and diverse terrain types". Extracted: scene type *snow and ice*; spatial layout *surround by mountain*; visual
style *cartoon, NPR*; main objects *tree, house, stone, fence, torch*; terrain categories *forest, ice, snow, hill,
road*.

## 4. Stage 2: global terrain (§2.2, Fig. 2)

### 4.1 Terrain planning (§2.2.1)

`P_terrain = (p_layout, p_asset, p_material, θ_terrain)` (Eq. 4), under "a standardized schema":
- `p_layout`: region categories, relative positions, adjacency and approximate coverage;
- `p_asset`: terrain-associated asset categories, regional affinities and target densities;
- `p_material`: surface types, visual styles and texture requirements per region;
- `θ_terrain`: **world scale, base elevation per region, noise frequencies and amplitudes, geomorphic operators and
  their weights, and boundary-blending widths.**

**Tool-augmented planning.** The agent may call a search tool for references. When text can't express a spatial or
stylistic intent, it makes a **concept image** `I_concept`. The concept image is an optional condition for later stages
and never overrides an explicit user constraint.

The Fig. 1 example's plan text: (a) layout design "… a cold biome with frozen lake, forests, road path …"; (b) material
and assets design "forest: deep green-brown …, road path: dark gray-brown …, 3d assets: snow-covered tree, stone, ice,
blue flame torch …"; (c) terrain design "frozen lake: hmap(x0, y0) …, forests: hmap(x1, y1) + rise …, road path:
width(x2, y2) * p …". So the terrain design is **per-region height formulas written by the LLM**.

### 4.2 Terrain asset generation (§2.2.2)

`A_terrain = (I_layout, I_asset, O_asset, M_terrain)` (Eq. 5). Both images come from **GPT-Image-2**.
- **Semantic layout map `I_layout`.** A top-down image in which each predefined terrain category is one flat colour.
  Floor plans don't suit curved natural boundaries, so a painted colour map is the single 2D partition. Region masks,
  the height field, material assignment and scatter all read it.
- **Asset prototypes `O_asset`.** Images of rocks, vegetation clusters and "landform attachments", turned into 3D by
  Hunyuan3D. They are reusable and carry no position; they feed the scatter.
- **Materials `M_terrain`, two pathways.**
  - *Generative*: albedo, normal and roughness maps for small complex surfaces.
  - *Procedural*: Blender node graphs assembled by code, tileable and parametric, for large regions.

  Both bind to the layout map's regions.

Fig. 1 names the skills here: `gen image` (prompt `scene_plan.yaml`, script `img_gen.py`) makes the layout map, the
object images and optional texture maps. `3d gen` (`img_to_3d.py`) makes the mesh and texture. `tex gen` (`tex.py`)
makes either a procedural texture (node graph) or a texture map, wired Tex → BSDF → Material.

### 4.3 Terrain generation and refinement (§2.2.3)

**Initial height field.** The agent maps the layout map's colours to categories, extracts one mask per region, and
smooths the boundaries into normalised soft weights `m̃_r`. The height field is (Eq. 6, in the project page's
bracketed form, which matches the paper's "region-specific composition"):

```
H(x) = Σ_r  m̃_r(x) · [ h_r  +  Σ_k w_{r,k} · N_{r,k}(x)  +  Σ_j α_{r,j} · G_{r,j}(x) ]
```

- `h_r` is the region's base elevation.
- `N_{r,k}` is a noise component at one spatial frequency. The figure lists **fBm, Voronoi and gradient noise**.
- `G_{r,j}` is a **geomorphic operator**. The figure lists **peak, crater, dunes, terrace, erosion**.
- `w` and `α` weight them. The paper cites Red Blob Games' "Making maps with noise functions" [64] for the noise side.
- Fig. 2's code panel shows each region compiled to a function: `def **_terrain(c_i): mask = map[c_i]; rise =
  float(…); pow = float(…); drop = float(…); … field = rise + drop`.
- Its inputs are `scene.yaml` (colour map, terrain params, material type, "base envelop") and `layout.png`.
- The same weights blend the materials.

**Global scatter** (Fig. 2b). This is only for terrain-bound ecology (rocks, plant clusters, attachments). Objects with
a function or identity wait for Stage 3. Per category, candidate points are sampled inside the region masks by affinity
and density. They are filtered by elevation, slope and normal, then scaled and turned to the local surface "to reduce
floating, penetration, and unnatural distributions". The figure shows the sampler as data:

| Sampler | Parameters shown |
|---|---|
| Poisson disk | `dis_min 1.8`, `den_max 1.2` |
| random | `den 1.4` |
| Poisson disk | `dis_min 0.5`, `den_max 11` |

The script is `scatter.py`, reading `scatter_plan.yaml` and executing `bpy`.

**Terrain refinement** (Fig. 2c). Through **BlenderMCP** (ahujasid/blender-mcp, open source), the agent re-renders from
**predefined viewpoints**, inspects, and edits locally. The figure's editable groups:
- **params**: warp, amplitude, density, slope;
- **scatter**: density, radius, scale, sampler;
- **material**: coordinates, colour, roughness;
- **skybox**: azimuth, elevation, strength, colour.

The loop ends when no substantial issue is found or a predefined budget runs out. Fig. 1 shows `/loop (3/5)`: a budget
of 5 rounds, with `preview_03.png` as the render.

## 5. Stage 3: regional objects (§2.3, Fig. 3)

### 5.1 Regional planning (§2.3.1)

The planner looks at both `P` and the built `T`. It picks `R+ ⊆ R`: the regions that still have object requirements
**and whose local terrain can support the requested function**. For each it writes (Eq. 7):

`P_regional = { (r, φ_r, C^r_object, p^spatial_r, p^appearance_r) | r ∈ R+ }`

That is a functional role, the object categories with **counts** and densities, object–object and object–terrain
relations, and the region's appearance and style. The concept image may supplement it. Fig. 1's example divides the map
into four rectangles: **a Festival Plaza, b Cabin Village, c Supply Site, d Fishing Village**.

### 5.2 Region composition (§2.3.2)

1. Render the existing terrain for region `r` and **record its camera** `κ_r = (K_t, E_t)` (intrinsics, extrinsics):
   the terrain image `I^terrain_r`.
2. Turn `P_r` into a structured prompt. Generate the composition by **editing that render** (Eq. 9):
   `I^comp_r = G_image(I^terrain_r, P_r, I_concept)` (`img_edit.py`, input `region_b.png`).
3. The composition is "not … final 3D geometry; … an explicit 2D layout prior that jointly constrains object
   appearance and spatial organization".

### 5.3 Object extraction and reconstruction (§2.3.2)

1. **Text-guided SAM3** segments the instances, on the full image plus **overlapping sliding windows** for small
   objects. Local predictions are mapped back, then **deduplicated and merged by semantic label and spatial overlap**
   (`img_to_3d.py --det`, output to `objects/`).
2. Each instance is cropped and enlarged into an object-centric image `I_i` and mask `S_i`, keeping the affine `A_i`.
   The crop's equivalent intrinsics are `K̂_i = A_i · K_t` (Eq. 10). The extrinsics stay `E_t`, so a pixel in the crop
   maps back with `A_i⁻¹`.
3. **SAM3D** takes `(I_i, S_i)` and predicts the mesh `M_i`, appearance `U_i`, a local-to-object-camera transform
   `T^l2c_i` and its own camera intrinsics `K^o_i`.
4. **Scale calibration** (Eq. 11). `B(I)` is the ratio of foreground bounding-box area to image area. Scale `λ_i` about
   the mesh centre is iterated until `−ε⁻ ≤ B(Π(K^o_i, λ_i·M^c_i)) − B(I_i) ≤ ε⁺`. The tolerance is asymmetric: oversize
   is suppressed harder than under-coverage, because mask edges and single-view ambiguity cause the latter.
5. Fig. 1 shows the reconstructed object list running to **obj 50** for one region.

### 5.4 Placement (§2.3.2, Eqs. 12–13)

- **Ray 1**, from the object camera through the object-centre pixel, hits the camera-space mesh: point `P_o`, depth
  `Z_o`.
- **Ray 2**, from the terrain camera through the same centre (mapped back with `A_i⁻¹`), hits the terrain mesh: point
  `P_t`, depth `Z_t`. Because `K̂_i = A_i K_t` and the extrinsics are unchanged, the two rays are the same ray. That is
  what lets a small object be reconstructed at high resolution without losing placement accuracy.
- **Scale** (Eq. 12), assuming square pixels and locally uniform perspective: `s_i = (Z_t · f^o_i) / (Z_o · f̂_i)`.
- **Rotation** `R_i` comes from the two cameras' extrinsics.
- **Transform** (Eq. 13): `T_place = [[s_i R_i, P_t − s_i R_i P_o], [0, 1]] · T^l2c_i`. It maps `P_o` exactly onto
  `P_t`. Drop the right factor if `T^l2c` is already baked into the exported vertices.
- **Contact search.** The anchor depth and an isotropic scale are searched jointly along the terrain-camera ray,
  **keeping the 2D projection fixed**. The search stops when the share of the object's bottom voxels touching the
  terrain reaches a threshold, else keeps the best candidate. This fixes "slight floating caused by mesh discretization
  and single-view depth errors".
- The skill is `3d_placement.py`, reading `3d_models/` and `cam_param`.

### 5.5 Scene refinement (§2.3.3, Fig. 3)

An agent connected to Blender over MCP keeps a **task queue of diagnostic renders and status reports** ("log
(object): Processing ← obj 1, Pending ← obj 2"). Objects are refined first, then terrain.

**Object refinement** (Fig. 3a).
- It reads the object's attributes (semantic category, geometric properties, a zoom-in view) and the region's (region
  design, object composition, scene concept).
- It runs `object_refine(o_i)` over `pose`, `size` and `orient`, then `status = object_check(…)`. The figure shows
  "Pose, Mesh quality ✓; Scale (too large) ✗ → refining…", then `re-render.png`.
- A low-quality SAM3D mesh is regenerated by **Hunyuan3D conditioned on the scale-calibrated coarse mesh plus the
  object-centric image**. The coarse mesh constrains the structure; the image supplies shape and appearance. The new
  asset inherits `T_place`, so nothing is placed twice.
- Fig. 1 shows `/loop (6/15)` per region (a budget of 15), a `closeup render (render_06.png)`, the current
  `object_07.glb`, checks on pose `(t, r)`, scale `(dim, s)` and quality `(mesh, tex)`.

**Terrain refinement** (Fig. 3b).
- It runs `terrain_refine(o_j, t)`: `distance = compute(o_j, t)`, then `status = terrain_check(…)`. The checks are
  mesh quality and **collision (suspension)**, meaning floating.
- The fix is **object–terrain co-deformation inside the local support region only**. The object is moved vertically or
  partly embedded; the terrain under it is displaced, flattened or smoothed to its footprint.
- Fig. 1 shows a counter "terrain refine ↓ 4.8k" and checks collision `(c, p)` and quality (mesh).

## 6. Implementation details (§3.1): the whole list

- Agent model: **Claude Opus 4.8**.
- "Task-specific agent skills that extend the agent with the pretrained foundation models (**GPT-Image-2, SAM3, SAM3D,
  and Hunyuan3D**) and executable 3D tools."
- Hunyuan3D refinement output: **2048×2048 PBR maps for large objects, 1024×1024 for small.**
- Hardware: **4 × NVIDIA H20**.
- Terrain, object generation and placement, scene refinement and rendering all happen in **Blender 5.1.1**.

**Not reported anywhere:**
- world size in metres;
- object or triangle counts per world;
- texture memory;
- wall-clock time per stage or per world;
- token or API cost;
- iteration counts actually used;
- failure rate or re-roll rate;
- any numeric metric;
- any user study.

## 7. Results (§3.2–3.3, §7)

**Main figures** (each has the prompt, a global view, four regional views, four walk views, and the walk views as
instance, depth and normal renders):

| Fig. | Prompt (abridged) |
|---|---|
| 4 | a tropical island pirate stronghold, "inspired by … One Piece" |
| 5 | a canyon with a river through it, primitive tribal villages on the cliffs and valley floor |
| 6 | a desert battlefield "inspired by PUBG's desert maps … for large-scale PvP" |
| 7 | a realistic snow-covered mountain valley "in the style of Command & Conquer: Red Alert" with futuristic high-tech buildings |

**Extra worlds** (Figs. 9–15): a medieval village across snow peaks, plains, water and desert, with animals; a
snow-covered riverside village; a desert camp with massive coiling dragons; an island of Japanese-style towns; a
volcanic demon lair with glowing lava; a gemstone mine with excavation equipment; a mountain valley with Hobbit-style
villages.

**The comparison** (Fig. 8). The prompts share a medieval-village theme, worded to suit each method. There are four
walk views per method, judged on three axes:
1. *Terrain and region organization*:
   - SynCity: weak long-range organization.
   - Marble: no region structure.
   - MajutsuCity: flat, regular ground.
   - WorldGen: flat, homogeneous terrain.
   - The GPT-5.6 Sol coding agent: "simple geometric forms".
2. *Content richness and prompt alignment*:
   - SynCity: repeated structures.
   - Marble: few categories.
   - MajutsuCity: urban only.
   - WorldGen: limited variation.
   - GPT-5.6 Sol: "blockout-like".
3. *Free-viewpoint appearance*:
   - Marble degrades with distance and shows Gaussian primitives up close.
   - SynCity has block seams.
   - WorldGen (Meta) is called "the closest baseline … in terms of downstream usability".

Read the comparison for what it is: every method's own wording, four views each, and no blind judging.

## 8. Limitations, in the paper's words (§5)

1. **Dependency on the models.** "current open-source language models often struggled to generate procedural terrain
   and materials that were both executable and consistent with user requirements. Likewise, open-source image
   generation models frequently failed to produce usable semantic layout maps or to preserve object appearance and pose
   during object-image generation and extraction … fully validating this decoupled pipeline at the current stage still
   requires capable models such as Claude Opus 4.8, GPT-Image-2, and Hunyuan3D."
2. **Code-generation stability.** Errors in scale, numbers or node connectivity show up directly as wrong landforms,
   materials or layouts, "often necessitating multiple render–inspect–refine iterations". Blender's API and node graphs
   are hard for LLMs, so "material effects that artists can construct with sophisticated node graphs are often reduced
   to relatively simple approximations."
3. **Efficiency.** Per-object generation plus many refinement rounds give "substantial inference latency and
   computational cost", growing with object count and iterations. For simple scenes it is "unnecessarily lengthy".

## 9. Conclusion and future work (§6)

- **Code-native 3D modeling.** Generative meshes lack part hierarchies, parameters, articulation and interaction logic.
  WorldClaw already writes terrain materials as Blender node graphs and shader scripts. The authors want executable
  programs to replace object generation where they can, "eventually … primarily, or even entirely, through executable
  code."
- **Production engine integration.** "large-scale game-world construction additionally requires runtime systems for
  procedural generation, navigation, physics, and interaction." Unreal's PCG is named as the next host.

## 10. Related work worth following up (§4)

| Ref | What it is | Why it matters to us |
|---|---|---|
| [1] BlenderMCP | open MCP server driving Blender | our Blender runs headless by script (`scripts/blender/build.sh`); MCP is optional |
| [80] WorldGen (Meta) | layout reasoning + procedural blockout + **navigation constraints** + reference image + holistic reconstruction + decomposition | the closest baseline; it already thinks about traversability |
| [12] SAM 3D Objects (Meta) | single-image object → mesh + pose | weights open under the SAM licence; CUDA only, no MPS support |
| [6] SAM 3 | text-prompted segmentation | the same: no MPS today |
| [32] Hunyuan3D 2.1, [38] Hunyuan3D 2.5 | image → mesh + PBR | 2.1 is on this Mac; 2.5 and 3.x are API only |
| [64] Red Blob Games | noise-based terrain primer | the noise vocabulary of Eq. 6 |
| [28] SceneCraft, [102] VIGA, [83] SceneCode | LLM writes Blender / graphics code, with a render–inspect loop | the code-execute-render-inspect pattern we already use (LOOK-LOOP) |
| [17] LatticeWorld, [53] LandCraft | LLM to layout to engine terrain | the layout-map-to-heightfield idea before WorldClaw |
| [33] HY-World 2.0, [78] HunyuanWorld 1.0 | Tencent's video- and panorama-based world models | the other Tencent line; it makes Gaussians or one mesh, not instanced models |

## 11. What the paper means for a game

- The output is **a Blender scene**: one terrain mesh, scattered prototypes, and per-region object meshes with 1–2K
  PBR. It is built for offline renders, not real-time phone frames.
- Nothing about colliders, walkability, navigation, LODs, draw calls, memory or streaming. The authors list exactly that
  as future work.
- What is reusable for us is the **method**: the schema-first plan, the layout map to Eq. 6, the masked scatter
  samplers, paint-then-lift with recorded cameras, ray-pair placement with contact search, and bounded refine loops with
  check functions. [03](03-our-primitives.md) maps each one onto the game, and [04](04-our-pipeline.md) designs our
  version.
