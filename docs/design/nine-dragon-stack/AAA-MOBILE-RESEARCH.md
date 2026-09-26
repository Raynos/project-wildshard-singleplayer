# Nine Dragon Stack: how AAA mobile games render stylized worlds

**Ask:** E169 · **Date:** 2026-09-25 · **Status:** research, no code. It feeds the clean-room detail pass
(`dev/nine-dragon.html`, `src/dev/nine-dragon/`).

Jake: *"Spawn research agents as needed to see how other games are made (AAA iOS)."* This file covers the external
games. [`TECHNIQUES.md`](TECHNIQUES.md) covers what our own shards already built, and
[`ART-STYLE-RESEARCH.md`](ART-STYLE-RESEARCH.md) §4.1 and §5 hold the 界画霓虹 Jiehua Neon style bible that both files
serve.

**The target:** three.js 0.186 on WebGL2 in an iOS home-screen PWA, portrait, ≥ 30 fps at **DPR 2, which is 804×1748
= 1.41 MP** on an iPhone 16 Pro-class screen. The render scale is never cut. The costs below are **estimates at 1.41 MP
on an A17/A18-class tile GPU**. Replace them with `scripts/bench` numbers. For scale, the clean room measured 2.4 ms for
its whole post chain at 1206×2622, with 91 draws, on the Mac (`TECHNIQUES.md` §0).

---

## 0. The answer: ten techniques for Jiehua Neon on an iPhone

What the shipped games have in common: **the phone's GPU time goes to the pixels the player looks at. Lighting and
shadows are baked, far detail becomes flat colour, and nothing expensive is simulated (volumetrics, SSR, real-time GI)
when an analytic fake or a baked one will read the same at 6 inches.** Jiehua Neon is unusually well suited to this,
because its look *is* flat washes, ruled lines, blank fog and emissive neon.

| # | Technique | Recipe (three.js / WebGL2) | Est. cost @1.41 MP | Proven in |
|---|---|---|---|---|
| 1 | **Ruled lines drawn inside the one architecture material** | Face-local metre UVs (`aFace`). Line = `fwidth`-AA'd distance to the ruling, **constant pixel width**. When the ruling *spacing* falls under ~4 px, the lines fade to their average coverage (the wash) instead of forming moiré. No textures, no discard, MSAA 4× for geometry edges, **no TAA** | 0.15–0.3 ms | Guilty Gear Xrd (inner lines as axis-aligned UV beams: "jaggie free super clean lines even at close-ups"); Hi-Fi Rush (world-space patterns with smoothstep AA "to prevent shimmer"); Ben Golus's grid / Humus's phone-wire AA |
| 2 | **One post silhouette pass on depth + a surface ID** | Write a per-surface ID hash into the **alpha of the RGBA16F world target** (opaque pass). Transparents keep it via `blendSrcAlpha = ZeroFactor`, `blendDstAlpha = OneFactor`. Composite: 4–8 taps comparing depth (threshold ∝ linear depth) **and** ID; 2 px wide at DPR 2, smoothstep on the gradient (not a binary test), fogged like the lines. No MRT, no second scene render | 0.4–0.6 ms | Sable (depth + normal edges); Mars First Logistics / Omar Shehata (surface IDs remove false edges); Genshin (outer lines from depth); Obra Dinn (every shape outlined; the line colour inverts on dark ground, which is our gold-on-indigo) |
| 3 | **Brush inverted hull on living things only** | A back-face hull pushed along **smoothed normals** stored in a vertex attribute. Width = vertex colour × a distance scale (clamped in pixels). A dry-brush strip texture along the hull for 飞白. Enemies, NPCs, the Jian, hands; never architecture | 0.2–0.5 ms (few meshes) | GGXrd (vertex colour width, erased where wanted); Honkai Impact 3rd (smoothed normals in vertex colour, distance scaling); HSR and Genshin characters |
| 4 | **Baked light, 2 bands, no shadow maps** | Vertex colour carries the wash, AO and the neon spill, all baked at build time. The shader does `wash × (lit ? 1 : 重墨 tint)` from the sky-screen top light. At most 4 dynamic points. A **capsule/blob shadow** under the player and enemies only | ~0 ms in material; saves 1–3 ms vs CSM | Genshin (far LOD lighting baked to **vertex colour**); Monument Valley (custom directional light + lightmapped AO); Hi-Fi Rush (step lights, **decal lights**, capsule shadows for enemies); NTE (shadows were the cost worth caching) |
| 5 | **Analytic banded silk fog, not volumetrics** | Fog = the ray's exact integral through **box-shaped density bands** (one overlap per band, 9 bands, ~40 ALU). Colour = the band's silk. Lines fog before the washes; neon fogs at ×0.5. At Well mouths only, add 2–4 **soft fog cards** (depth-faded quads) for parallax | 0.05–0.15 ms (+cards ~0.1) | Genshin (distance + height fog, cloud seas as mesh planes "instead of volumetric ray-marching"); Inigo Quilez analytic fog; Alto's Odyssey (muted parallax layers = depth) |
| 6 | **Neon: MSDF calligraphy on emissive quads + emissive-only dual-filter bloom** | Sign strokes as a (M)SDF atlas → crisp at any distance, with a glow falloff in the same fetch. Bloom: Karis-weighted prefilter at half res, **4 down + 4 up dual filter**, composited in the single final pass and soaked into the silk. Threshold > 1.0 so only emissive blooms | signs ~0.1; bloom 0.3–0.5 ms | Valve SDF glyphs (SIGGRAPH 2007); Chlumsky MSDF; ARM dual filter (7 % of a naive blur's bandwidth); Honkai 3 (4-level bloom, single-pass composite); GTA V (1/16 pyramid) |
| 7 | **Wet ground reflects only what is bright** | A mirror camera at **¼ res** that draws only the emissive layer (signs, lanterns, lit windows as sprites), blurred **vertically** (a streak) and broken by ripple noise. The ground darkens 20–30 % where wet. Drizzle rings are procedural ruled circles. No SSR. The fallback is one additive reflection card per sign | 0.3–0.7 ms | BotW (ground SSR set to reflect only high-brightness colours = fake area lights); Honkai 3 (reflection RT at **⅓ res**, simplified materials, minor objects omitted); GTA V (water planar at 240×120); Lagarde (wet = darker diffuse, stronger spec) |
| 8 | **Kit instancing + multi-draw + one program** | Every repeated piece (AC box, cage, sign, balcony, pipe run) is an `InstancedMesh` or a `BatchedMesh` (WEBGL_multi_draw: iOS Safari 99.99 %). Static strata are merged per region. The budget at the spawn is **≤ 150 draws, ≤ 1 M tris**. Frustum + stratum culling on the CPU | CPU: Safari's per-call cost is the risk | The Matrix Awakens (7,000 buildings from a modular kit, 7 M instances); Arknights: Endfield (500 k candidates → tens of thousands after culling; batching 3 ms on Android); Genshin (instanced grass) |
| 9 | **Facade density from the shader, then decals** | Windows, slab lips and mullions are procedural (already so). Add **interior mapping inside the window mask only** (a ray against 3 planes, one atlas fetch of 8–16 painted rooms). Grime, posters and couplets go on shared **decal cards** (alpha-blended quads in one atlas, drawn after the opaques) | +0.2–0.4 ms at ~25 % window coverage | Marvel's Spider-Man (rooms as cube textures from an atlas, "no geometry"); SimCity 2013; Cyberpunk (mesh decals); Spider-Man 2 (32 fake rooms, ray-traced) |
| 10 | **Distance = wash + lights** | The line fade is the LOD: past ~80 m a tower is a merged box with washes and a **point-sprite field of lit windows and neon dots**. Far props become impostor cards. Each fog band hides the LOD swap behind it. Dissolve LODs, never pop | Saves vertices; the sprites ~0.1 ms | GTA V (fog hides "the lack of details of the low-poly buildings in the distance"); Fortnite (octahedral impostors on mobile); AC Mirage iPhone (its presets cull LOD and density first) |

**The frame, summed (estimate at 1.41 MP, one Well view):**

| Pass | Est. ms |
|---|---|
| Opaque world, one program (lines, ramp, fog, windows, interiors) | 3–5 |
| MSAA 4× resolve of the world target (+ depth) | 0.3–0.6 |
| Wet mirror, ¼ res, emissive only | 0.3–0.7 |
| Transparents: neon quads, decal cards, rain, fog cards (overdraw is the risk) | 0.5–1.5 |
| Enemies and viewmodel, brush hull included | 1–2 |
| Bloom, half-res dual filter | 0.3–0.5 |
| One composite: silhouette, bloom-in-silk, grade, grain | 0.5–0.8 |
| **Total GPU** | **~6–11 ms** → 60 fps is reachable at DPR 2, and 30 fps has room for thermals |

**Three tile-GPU rules that sit under all ten** (Apple's Metal guidance, which WebGL inherits through ANGLE-Metal):

1. **No `discard`, alpha test or depth write from the fragment shader in opaque programs.** They disable the GPU's
   hidden-surface removal, so every covered fragment gets shaded. Draw order is opaque → alpha-tested → blended.
   The clean room's `ALPHA_CUT` program (cage bars and net wrap, two `discard`s in `style.ts`) sits in three's opaque
   list, so give those meshes a `renderOrder` after all walls. Near cages can become real bar geometry.
2. **Every full-screen pass is a real store and load.** WebGL has no memoryless targets, no framebuffer fetch and no
   MetalFX. So fuse the post into one composite, keep the bloom at half res, and set
   `renderTarget.resolveDepthBuffer = false` on any MSAA target whose depth nobody reads, such as the mirror. three
   0.186 then invalidates it and does not store it.
3. **MSAA is cheap on tile memory. TAA is wrong here.** Apple resolves MSAA on-chip and only per-sample-blends edge
   pixels. TAA would smear the 1–2 px ruled lines and make them crawl. Stable lines are the "expensive" look.

---

## 1. Per-game notes

These are short. They list only what bears on us. "Official" means a developer talk or interview; "community" means
reverse-engineering or reviews.

### Stylized open worlds on phones

- **Genshin Impact** (Unity, miHoYo).
  - Official: the GDC 2021 talk says "different render pipelines for characters and scenes": the toon pipeline is for
    people, and the world is lit more realistically, then stylized.
  - Community frame analysis:
    - lightmaps in three tiers: a high-res lightmap near, a low-res one in the middle distance, **vertex-colour lighting
      far**;
    - light probes along shadow edges for dynamic objects;
    - cloud shadows as a world-XZ scrolling noise;
    - distance + height fog plus particles;
    - cloud seas as mesh planes, not raymarched;
    - instanced grass.
  - Official (Unite 2020 console talk): outer lines by depth-edge detection, inner lines from a custom-depth mask.
  - **Lesson:** bake far light into vertex colour, fake atmosphere with planes, and give characters their own pipeline.
- **Honkai Impact 3rd** (Unity, miHoYo; He Jia's talk on high-quality mobile toon). This is the ancestor of every
  miHoYo toon game.
  - Outlines are back-face extrusion. Their width is set by vertex colour and scaled with distance, and the smoothed
    normals live in vertex colour so hard edges don't split.
  - Diffuse uses multi-channel 2D ramps.
  - Characters get their own shadow map, fitted tightly.
  - **The reflection RT is at ⅓ res with simplified materials and minor objects dropped.**
  - Bloom is a 4-level blur, with all compositing in one pass.
- **Honkai: Star Rail** (Unity URP-derived; community rebuilds). Characters: smoothed-normal outlines stored in tangent
  space so they survive skinning, SDF face shadows, and ramp textures split by warm and cool. Environments are mostly
  line-free, lit stylized PBR.
- **Zenless Zone Zero** (a customised Unity, the "Tuanjie" fork; community). This is the closest shipped **stylized
  city**. The line colour and weight vary by location instead of being uniform black, and the shadows are soft. Sixth
  Street is a small, dense hub: shop clutter, signs, graffiti and posters, which is **authored density in a tight
  space, not an open city**.
  - **Lesson:** a small, hand-dressed street reads richer than a big generated one.
- **Wuthering Waves** (a heavily customised UE4, Kuro).
  - Unreal Fest '23 Shanghai covered time-of-day shadows and vegetation on mobile, with texture and mesh density
    categorized per platform.
  - The 2025 talks moved on to PC ray tracing.
  - **Lesson:** a separate asset tier for mobile, not the same assets scaled down.
- **Neverness to Everness** (UE5, Hotta; Inven Global talk report). This is a stylized **urban** open world with night
  neon and wet asphalt.
  - Shadows: the day is split into **12 segments with the sun frozen in each** so shadow maps can be reused. Mobile
    runs a hybrid CSM + layered shadow map that **updates incrementally over several frames, and only when the player
    moves**. On PC this cut shadow updates by 90 % and GPU cost by 20–30 %.
  - Reflections: wet asphalt and neon make reflections "a defining visual characteristic". Lumen and hardware RT
    turn on only on top-tier profiles that pass runtime checks. Otherwise the game uses SSR.
  - Crowds: UE Mass with submission caps held about 60 fps with 300 agents on Android.
  - Devices: 390 k device profiles.
  - **Lesson:** shadows and reflections are where a neon city spends its budget, so we bake the first and fake the
    second.
- **Ananta** (Unity, NetEase Naked Rain; release 15 Jan 2027). A stylized urban open world. Its only public tech note is
  dynamic rendering against thermal throttling. Watch it at launch.
- **Where Winds Meet** (NetEase Messiah engine; a wuxia Song-dynasty world, the closest *Chinese* subject). The engine
  was chosen to "allocate performance more effectively based on hardware differences". The iPhone 17 Pro Max averages
  about 60 fps in most scenes (Notebookcheck). This is a photoreal-leaning look, so it is a proof of scale, not of
  style.
- **Infinity Nikki** (UE5, Papergames). It uses Enlighten precomputed GI for dynamic bounce on mobile, because
  real-time GI was too costly there. Papergames calls mobile performance "a significant challenge". **Lesson:**
  precomputed light is the mobile answer, even in UE5.
- **Arknights: Endfield** (a rebuilt Unity: ECS plus a native C++ render pipeline).
  - On a Snapdragon 8 Gen 1, 500 k candidate objects are culled to tens of thousands.
  - Batching takes 3 ms on Android (1 ms on PC).
  - One culling result is shared across 10–20 views per frame, with zero per-frame allocation.
  - Mobile characters are 40–50 k tris (80–100 k on PC).
  - **Lesson:** a dense industrial world on a phone is a CPU and culling problem before it is a pixel problem. That
    matches `ART-STYLE-RESEARCH.md` §4.1: draw calls and vertices are our real risk.

### Mobile-first art games

- **Sky: Children of the Light** (thatgamecompany's own engine).
  - GDC 2025: image-based lighting, self-shadowing, transparency, fur and glitter "within the limitations imposed by
    mobile hardware".
  - GDC 2024: 10,000 players rendered in one concert.
  - **Lesson:** one strong light-and-colour idea per realm, and the budget spent on the characters.
- **Monument Valley 1–3** (Unity, ustwo). A custom directional lighting model instead of Unity's surface shaders,
  lightmapped AO, and "hefty overdraw for vignetting and faked volumetric glows". **Lesson:** flat colour + baked AO +
  a few additive glow cards is a whole look.
- **Alto's Odyssey** (Unity). The depth comes from parallax layers that get more muted with distance, plus a colour
  palette per time of day. **Lesson:** that is our silk bands, in 2D.
- **绘真·妙笔千山 *Miaobi Qianshan*** (NetEase with the Palace Museum, iOS 2019). A 3D-plus-2D puzzle game in **青绿
  blue-green landscape**, built directly from Wang Ximeng's *A Thousand Li of Rivers and Mountains*. The team distilled
  the painting's 钩框 outline, 皴 texture strokes and 晕染 washes into "layered hand-painting and 3D models". **This
  is the one shipped mobile precedent for our mineral palette.** Ours differs in being ruled architecture at night
  with neon. Play it for the palette's contrast at phone size.

### Console ports on iPhone: what they give up

| Game | iPhone 15 Pro output | What it gave up |
|---|---|---|
| Resident Evil Village | 1560×720 at 30 fps with MetalFX (TouchArcade, DF) | resolution first |
| Death Stranding DC | ~400p dynamic, below a stable 30 (DF / Oliver Mackenzie) | image clarity; PS4-like settings |
| Assassin's Creed Mirage | 1278×590 output, lower internal + upscale, 30 fps cap and still dropping (GSMArena) | medium → low culls distant LOD and object density, simplifies meshes (trees, railings), cuts shadow resolution and drops decals. Textures stay blurry on every preset (memory) |

**The lesson for us:** photoreal on a phone means 400–720p, a blur and 30 fps with dips. WebGL has no MetalFX anyway. A
**resolution-honest style** (flat washes and analytic lines, which are sharp at native DPR 2) looks more expensive on a
6-inch screen than a port does. That is our advantage. Keep it by never letting the look depend on texture resolution.

---

## 2. Dense-city tricks that are cheap

| Trick | How it works | Cost on a phone | Where it's proven | For the Stack |
|---|---|---|---|---|
| **Interior mapping** | Per window pixel, cast the view ray into a virtual room grid. Intersect only the 3 facing planes (ceiling or floor + 2 walls), then look up a room texture from the hit point. Room depth, furniture card and lighting vary by a per-window hash | ~20–30 ALU + 1 fetch, only inside the window mask | Spider-Man (cube-texture rooms from an atlas), SimCity 2013 (one texture, varied depths), Watch Dogs, Gears; the method is van Dongen 2008 | Paint 8–16 **ink-and-wash rooms** (a shrine shelf, a mahjong table, bunk cages, a noodle counter) into one 512² atlas. Lit windows get the room tinted by the lamp colour; dark windows get the back wall only. It gives the facades the parallax the mockup has and the clean room lacks |
| **Procedural facade modules** | Slab lips, windows, mullions and AC boxes come from hashes of face-local coordinates. Variety comes from per-module hashes, not textures | in the material | Clean room already does it; SimCity-like | Keep. Add **per-floor irregularity**: 1 floor in 5 shifts its module, some bays extend as cages. KWC's density comes from irregular additions, not the grid |
| **Decal cards** | Shared atlas quads (posters, couplets, grime streaks, 福 diamonds, stickers) placed by the kit generator. Blended after the opaques | 1–3 draws total (instanced), overdraw ~0.2 ms | Cyberpunk (mesh decals as a final pass), Hi-Fi Rush (decal *lights*) | The mockup's "hand-painted clutter every metre" is ≥ 60 % decals and small instanced kit, not new buildings |
| **Instanced clutter kit** | 20–40 small pieces (AC unit, cage, laundry pole, pipe elbow, sign box, lantern) as `InstancedMesh`, one draw per piece per stratum | ~40 draws for all the clutter | Matrix Awakens (7 M instances from a kit), Genshin grass | Scatter them along ruled attachment lines: under windows, at slab lips, on balcony rails. Merge the static ones per region at build time |
| **Baked vertex light** | AO, neon spill and bounce go into vertex colour at build (the kit is procedural, so the bake is free at build time) | 0 at runtime | Genshin far LOD, Monument Valley, Hi-Fi Rush's light-probe GI | This is where the **warm lantern light** the round-5 board missed should come from: amber/red spill baked around every lantern and sign, not dynamic lights |
| **Emissive-only neon + bloom** | Signs don't light the world in real time. Cyberpunk uses real line/capsule lights for its neons ("most of Cyberpunk's lights are neons"); we can't afford that | Cyberpunk-class: out of budget. Ours: signs ~0.1 ms + bloom | Cyberpunk (line lights, full-res SSR, froxel fog: the PC ceiling), ZZZ, Monument Valley glow cards | Bake the spill (row above), bloom the source, mirror the source on the wet ground. Three cheap echoes that sell one light |
| **Wet ground** | Darken diffuse, raise spec, add puddle masks from a world noise, ripples as procedural rings or a 4×4 flipbook normal | in the ground material | Lagarde's *Water drop* series; NTE's wet asphalt | Clean room's streaks are faint (round-5 board): raise the mirror's gain, add puddle masks with **full mirror** (mirror × 1.0) against damp stone (× 0.3) |
| **LOD light fields** | Far windows and neon become point sprites (one instanced draw) once the tower is a merged box | ~0.1 ms | GTA V uses fog to hide low-poly distant buildings | Past 80 m a stratum is washes + dots of light, which is what the 深远 deep view down the Well should read as anyway |
| **Crowds** | A fixed budget of agents with capped per-frame updates | CPU | NTE (Mass framework, submission caps, 300 agents ≈ 60 fps on Android) | Silhouette NPCs (brush hull, 2-band) on a per-stratum cap; far ones as flipbook cards |
| **Fog alternatives** | Height or band fog (analytic), soft fog cards (depth-faded, additive, silk-coloured), a fog sheet at each stratum lip | 0.05–0.3 ms | Genshin (cloud-sea planes), Monument Valley (overdraw glows), Alto (layers) | Analytic bands everywhere; 2–4 cards only where the camera looks down a Well (deep distance) |

**Skip:**
- SSR: needs a second full-res pass and history, and smears lines.
- Froxel volumetrics: Cyberpunk-class.
- Real-time GI, Lumen or Enlighten.
- Cascaded shadows over the city.
- Planar reflections of the full scene.
- TAA.

---

## 3. Line rendering that doesn't shimmer

### 3.1 The methods, compared

| Method | Constant width? | Stable in motion? | Cost | Shipped in | Use in Jiehua Neon |
|---|---|---|---|---|---|
| **In-material lines from face/UV coordinates** (analytic distance + `fwidth`) | Yes (width in px from derivatives) | Yes: anchored to the surface, AA analytic | ALU only | GGXrd inner lines (axis-aligned UV beams); Hi-Fi Rush world-space halftones and hatches ("mapped in world-space … to prevent shimmer", "smoothstep and alpha blend to anti-alias"); grid shaders | **Primary.** All built edges, slab lips, mullions, rails |
| **Post edge detection** (depth / normal / colour / ID) | Yes (screen px) | Mostly. Thin geometry can flicker, and depth-only edges miss coplanar contacts | 1 full-res pass | Sable, Genshin (outer lines by depth), Borderlands-likes, Mars First Logistics (surface IDs) | **Secondary.** Silhouettes between objects, and occlusion edges the material can't know |
| **Inverted hull** (back faces pushed along normals) | Only with a clip-space width + a distance clamp | Yes on smooth meshes; breaks at hard edges without smoothed normals | Re-draws the mesh | GGXrd, Honkai 3, HSR, Genshin, ZZZ characters, Ōkami-style brush outlines | **Living things only** (brush, variable width, 飞白 strip) |
| **Geometry lines** (`LineSegments2` / fat-line quads, or crease edges baked as line meshes) | Yes | Aliases without MSAA; z-fights with its own surface; no fog unless custom | A draw per batch, and vertices ×4 | CAD viewers; gkjohnson's conditional edges in three.js | Only the **Fei Zhua gold filament** and hero cables. Not the city |
| **Barycentric wireframe** | Yes (derivatives of barycentrics) | Yes | ALU, but needs non-shared vertices | Stylized wireframe demos (mattdesl) | No: it draws every triangle edge. The face-UV method already chooses which edges ink |
| **SDF lines / glyphs** | Yes | Yes | 1 fetch | Valve TF2 decals and text, MSDF fonts | **Neon calligraphy**, seal stamps, the ruled drizzle rings |
| **ML / hand-animated lines** | Artist-driven | "Boils" on purpose | Offline | Spider-Verse (Kismet in Houdini, ML-predicted lines) | Not real time. The *boil* is a style lesson for enemies animated on twos |

### 3.2 What actually makes a line crisp on a phone

1. **Decide the width in pixels, not metres.** Jiehua lines are constant width, so the fragment computes
   `px = fwidth(d)` (metres per pixel) and draws `|d| < 0.5·w·px`, with a 1 px smoothstep edge. It never goes
   sub-pixel, so it can't alias as a line.
2. **The real enemy is spacing, not width.** Mullions every 1.2 m at 60 m away are ~3 px apart, and constant-width
   lines then merge into moiré. Golus's grid fix is the rule: as `spacing / px` falls from ~6 to ~3, blend the line
   towards its **average coverage** (`w·px / spacing`), which is a flat grey wash. That is exactly the style bible's
   "lines dissolve into wash with distance" (淡墨 → gone), and it becomes the LOD for free. Drop minor rulings first,
   then majors (slab lips), then face edges.
3. **Anchor everything to the surface.** Hi-Fi Rush moved its halftones from screen space to world space for exactly
   this reason, and Obra Dinn stabilised its dither so it moves with the scene. Screen-space silk grain is fine only on
   fog and sky, which have no surface.
4. **MSAA 4× for geometry edges, analytic AA for in-surface lines, no TAA.** On tile GPUs MSAA is resolved on-chip.
   TAA's history blur fights 1–2 px lines.
5. **Post silhouettes get AA from a soft threshold.** Use `smoothstep(t0, t1, depthDelta / linearDepth)` over 4–8
   taps at 2 px (DPR 2), not `step()`. Fade the line with the same fog as the lines (Obra Dinn draws a black line on
   white and a white line on black; ours goes ink → gold as the silk darkens).
6. **Colour-invert, don't thicken, on dark ground.** On indigo silk a black line vanishes, so switch its colour (the
   `uSutra` gold). Don't widen it.

```glsl
// constant-width ruled line with the density fade (d: signed metres to the ruling; s: ruling spacing in metres)
float ruled(float d, float s, float wPx) {
  float px  = max(fwidth(d), 1e-6);                  // metres per pixel at this fragment
  float cov = 1.0 - smoothstep(0.5 * wPx * px - 0.5 * px, 0.5 * wPx * px + 0.5 * px, abs(d));
  float avg = clamp(wPx * px / s, 0.0, 1.0);         // what the line averages to when rulings crowd
  return mix(avg, cov, smoothstep(3.0, 6.0, s / px)); // < 3 px apart: flat wash; > 6 px: crisp line
}
```

### 3.3 Chinese and brush precedents

- **Ōkami** (PS2 → HD). Sumi-e was chosen partly *because* full cel shading strained the PS2. It uses heavy outer
  strokes, lighter inner ones and a paper overlay. Lesson: silhouette ink heavier than interior ink, which matches our
  line table.
- **Realm of Ink** (Leap Studio, 2.5D). The team found that "pure ink-wash … has no concept of space; when it moves, the
  sense of space is instantly lost". They added depth cues. **This is our biggest risk, stated by the people who
  shipped it.** The silk bands, the line fade with distance and the mineral accents are what give the Stack its space.
- **Black Myth: Wukong.** The ink-wash pieces are the chapter-end animated shorts, not real-time rendering, so there is
  nothing to learn about technique.
- **Sable** (Moebius). Screen-space depth + normal edges and hand-drawn textures. Its flat colour holds up. Post-only
  edges can flicker on thin geometry, a property of the method, which argues for our in-material lines.
- **Tunic, Jusant.** Both get their style from shape and flat colour, with almost no texture (Jusant bakes detail into
  geometry). The same lesson again: flat is fine when the silhouettes and the palette are designed.

---

## 4. What makes a phone frame read as "AAA"

These are practical lessons from the games above, for a 390-pt-wide portrait frame.

1. **Crisp at native resolution beats rich and blurry.** Ports at 400–720p look cheap next to a stylized game at native
   DPR 2. Never let a look depend on texture resolution, TAA or upscaling.
2. **Stability reads as quality.** Nothing crawls, shimmers or boils on the architecture. Aliasing is the first thing a
   phone screen shows up close. Every pattern is surface-anchored and analytically AA'd.
3. **Three value groups, and one saturated one.** Silk (light), ink (dark) and mineral accents (mid, ~15 % of the
   frame) carry the picture. Neon is the only full saturation. Riot's layering rule for readability applies:
   background low contrast, gameplay pieces high contrast. Check every mockup in greyscale at phone size.
4. **Density goes in the foreground and middle ground.** The round-5 board's gap is exactly this: nothing between 20 m
   and the fog. AAA phone frames (ZZZ's Sixth Street, Genshin's Liyue) pack the 5–30 m band with small, readable
   clutter, then let the far layer go flat. That is Guo Xi's three distances as a density rule: near = detail,
   middle = mass + light, far = wash.
5. **Every light shows three times.** The source (neon plus bloom), its spill (baked warm vertex light) and its
   reflection (the wet mirror). Night cities look expensive because of light *count*; that makes it cheap for us.
6. **A colour script, not a colour.** Genshin's "seven regions, seven ideas", Sky's time of day per realm, and our nine
   silk tints. Moving between strata must change the picture on sight.
7. **Characters get their own pipeline.** Genshin said it outright. Living things drawn with a brush and built things
   drawn with a ruler is our version, and it makes enemies pop without extra light.
8. **Restrained post.** One grade (a LUT per stratum), grain, and emissive-only bloom. No chromatic aberration, no heavy
   vignette, no lens dirt: they read as phone-game filler.
9. **Hide LOD behind the style.** GTA V hides it behind fog, AC Mirage's low preset shows it. Our line fade and silk
   bands make LOD swaps look like the painting thinning out.

---

## 5. What to do next in the clean room (in order)

1. **Density pass:**
   - instanced clutter kit and decal cards along the ruled attachment lines (§2);
   - interior-mapped windows;
   - baked warm spill around lanterns and signs.

   Measure draws after it: ≤ 150.
2. **Fade crowded rulings to their average, not to zero.** `style.ts` already fades every ruling by spacing
   (`smoothstep(2.5, 5.0, spacing / px)`). But slab lips, rows and columns fade to *nothing*, so walls lighten
   suddenly with distance. Only the cages fade to a fixed 0.28. Fading to `wPx·px / spacing` (§3.2 point 2) keeps the
   ink tone as the lines dissolve, and it keeps the new density from turning into moiré at 60 m.
3. **Surface ID in alpha** for the silhouette pass. It catches signs and cages that sit just in front of walls.
4. **Wet ground:** puddle masks at full mirror strength, and set the mirror target's `resolveDepthBuffer = false`.
5. **Order the `ALPHA_CUT` cages and nets after all opaques** (`renderOrder`), and use real bars up close.
6. **Bench on a real iPhone**: `scripts/bench` plus the phone tier. Replace the §0 estimates.

---

## Sources

**Mobile stylized games**
- Genshin Impact: [GDC 2021, Crafting an Anime-Style Open World (Vault)](https://www.gdcvault.com/play/1027538/-Genshin-Impact-Crafting-an) ·
  [slides PDF](https://media.gdcvault.com/GDC+2021/2021GDC+_+Haoyu+Cai+_+presentation+file.pdf) ·
  [Unite 2020 console-rendering talk (GameLook)](http://www.gamelook.com.cn/2020/11/404063/) ·
  [Unity CN write-up](https://developer.unity.cn/projects/5fbb4407edbc2a0c41d52e5e) ·
  [unofficial rendering analysis (GameRes)](https://www.gameres.com/874408.html)
- Honkai Impact 3rd: [He Jia, high-quality mobile toon rendering (GameRes)](https://www.gameres.com/807345.html)
- Honkai: Star Rail: [StarRailNPRShader (community)](https://github.com/stalomeow/StarRailNPRShader) ·
  [rendering flowchart](https://srshader.stalomeow.com/latest/advanced/rendering-flowchart/)
- Zenless Zone Zero: [Wikipedia (engine)](https://en.wikipedia.org/wiki/Zenless_Zone_Zero) ·
  [visual dictionary analysis (Sohu)](https://www.sohu.com/a/791098028_482993) ·
  [Sixth Street level-design postmortem](https://www.gamedeveloper.com/design/level-design-postmortem-sixth-street-zenless-zone-zero-)
- Wuthering Waves: [Unreal Fest '23 Shanghai optimization showcase](https://www.youtube.com/watch?v=67-d1MiguH0) ·
  [Automaton on its custom UE4](https://automaton-media.com/en/column/even-from-a-developers-perspective-wuthering-waves-use-of-unreal-engine-is-borderline-perverse-a-ue4-game-decked-out-in-custom-technology/)
- Neverness to Everness: [Inven Global talk report](https://www.invenglobal.com/articles/25007/how-neverness-to-everness-mastered-high-density-open-world-and-pcmobile-optimization) ·
  [Unreal developer interview](https://www.unrealengine.com/developer-interviews/crafting-the-urban-open-world-of-nte-neverness-to-everness-with-ue5-across-pc-playstation-5-and-mobile)
- Ananta: [Wikipedia](https://en.wikipedia.org/wiki/Ananta_(video_game)) · [official site](https://www.anantagame.com/)
- Where Winds Meet: [FRVR on the Messiah engine](https://frvr.com/blog/news/where-winds-meet-devs-in-house-messiah-engine-over-ue5-performance-more-effective/) ·
  [Notebookcheck mobile comparison](https://www.notebookcheck.net/Where-Winds-Meet-Mobile-performance-compared-on-Apple-iPhone-17-Pro-Max-and-M5-iPad-Pro-and-Nubia-RedMagic-11-Pro-This-is-the-best-mobile-device-to-play-on.1184902.0.html)
- Infinity Nikki: [Silicon Studio, Enlighten GI](https://www.siliconstudio.co.jp/en/news/pressreleases/2025/250206InfinityNikki/250206InfinityNikki.html) ·
  [2026 roadmap, mobile performance](https://openworldgamer.com/posts/infinity-nikki-2026-major-update-60fps-mode-prologue-overhaul-more.html)
- Arknights: Endfield: [Inven Global, fields and factories with Unity](https://www.invenglobal.com/articles/24006/the-know-how-behind-arknights-endfield-seamlessly-implementing-fields-and-factories-with-unity) ·
  [Automaton](https://automaton-media.com/en/news/arknights-endfield-devs-heavily-modified-unity-to-accommodate-the-games-100000-polygon-characters-models-and-massive-factory-systems/)
- Sky: Children of the Light: [GDC 2025 character rendering](https://schedule.gdconf.com/session/glitter-fur-and-shadows-character-rendering-technology-of-sky-children-of-the-light/907475) ·
  [GDC 2024 Aurora concert](https://schedule.gdconf.com/session/how-we-got-10000-players-into-a-level-the-tech-behind-the-aurora-concert-in-sky-children-of-the-light/900029) ·
  [GDC 2020 art talk](https://gdcvault.com/play/1026903/Art-of-Sky-Children-of)
- Monument Valley: [Game Developer, Making the impossible possible](https://www.gamedeveloper.com/design/making-the-impossible-possible-in-i-monument-valley-i-) ·
  [Unity, MV3](https://unity.com/resources/monument-valley-3-blurring-art-and-design)
- Alto's Odyssey: [Harry Nesbitt](http://www.harrynesbitt.com/games/altos-odyssey/) ·
  [Making of Alto's Adventure](http://www.harrynesbitt.com/blog/the-making-of-altos-adventure/)
- 绘真·妙笔千山: [Palace Museum](https://www.dpm.org.cn/classify_detail/248504.html) ·
  [GeekPark](https://www.geekpark.net/news/237011)

**Console ports on iPhone**
- [TouchArcade, RE Village on iPhone 15 Pro](https://toucharcade.com/2023/10/26/resident-evil-village-iphone-15-pro-review-frame-rate-resolution-max-capcom/) ·
  [DF RE Village thread](https://www.neogaf.com/threads/digital-foundry-resident-evil-village-on-iphone-15-pro-vs-ipad-pro-m1-vs-steam-deck-resi-goes-mobile.1663260/)
- [DF Death Stranding on iPhone 15 Pro (DTF summary)](https://dtf.ru/hard/2476921-v-digital-foundry-protestirovali-death-stranding-na-iphone-15-pro-razreshenie-400p-i-net-stabilnyh-30-fps)
- [GSMArena, AC Mirage for iPhone](https://www.gsmarena.com/assassins_creed_mirage_for_iphone_review-news-63311.php) ·
  [DF AC Mirage on iPhone thread](https://www.resetera.com/threads/df-assassins-creed-mirage-on-iphone-15-pro.924204/)

**Lines and stylization**
- [GGXrd GDC 2015, Motomura (handout PDF)](https://www.ggxrd.com/Motomura_Junya_GuiltyGearXrd.pdf) ·
  [Vault](https://www.gdcvault.com/play/1022031/GuiltyGearXrd-s-Art-Style-The)
- Hi-Fi Rush: [GDC 2024, 3D Toon Rendering](https://gdcvault.com/play/1034330/3D-Toon-Rendering-in-Hi) ·
  [talk notes](https://www.foth.top/article/gdc-2024-hifirush-toonrendering-notes/) ·
  [80.lv](https://80.lv/articles/the-making-of-hi-fi-rush-s-3d-toon-rendering-style)
- [Ben Golus, The Best Darn Grid Shader (Yet)](https://bgolus.medium.com/the-best-darn-grid-shader-yet-727f9278b9d8) ·
  [Humus phone-wire AA](https://forum.beyond3d.com/threads/phone-wire-aa-demo.52844/)
- Surface-ID outlines: [Omar Shehata](https://omar-shehata.medium.com/better-outline-rendering-using-surface-ids-with-webgl-e13cdab1fd94) ·
  [webgl-outlines code](https://github.com/OmarShehata/webgl-outlines) ·
  [ameye edge-detection notes](https://ameye.dev/notes/edge-detection-outlines/)
- Sable: [Unity, Shedworks](https://unity.com/resources/shedworks-sable-modular-design-approach) ·
  [Creative Bloq](https://www.creativebloq.com/how-to/mix-procreate-and-unity-to-make-game-art-sable)
- Obra Dinn: [Zucconi](https://www.alanzucconi.com/2018/10/24/shader-showcase-saturday-11/) ·
  [Pope devlog](https://dukope.com/devlogs/obra-dinn/tig-32/)
- Wireframes: [mattdesl/webgl-wireframes](https://github.com/mattdesl/webgl-wireframes) ·
  [gkjohnson conditional edges](https://gkjohnson.github.io/threejs-sandbox/conditional-lines/) ·
  [three-edge-projection](https://github.com/gkjohnson/three-edge-projection)
- SDF glyphs: [Valve, Green 2007](https://steamcdn-a.akamaihd.net/apps/valve/2007/SIGGRAPH2007_AlphaTestedMagnification.pdf) ·
  [msdfgen](https://github.com/Chlumsky/msdfgen)
- Spider-Verse: [Linework in Across the Spider-Verse (ACM)](https://dl.acm.org/doi/fullHtml/10.1145/3587421.3595456) ·
  [fxguide](https://www.fxguide.com/fxfeatured/ink-lines-and-machine-learning/)
- Ōkami: [Wikipedia](https://en.wikipedia.org/wiki/%C5%8Ckami) ·
  [TCD real-time sumi-e thesis](https://publications.scss.tcd.ie/theses/diss/2020/TCD-SCSS-DISSERTATION-2020-056.pdf)
- [Realm of Ink interview (Rogueliker)](https://rogueliker.com/realm-of-ink-interview/)
- BotW: [graphics discoveries](https://guardhei.github.io/2019/10/breath-of-the-wild-graphics-discoveries/)
- Readability layering: [Riot, Defining the Rift's Visual Style (polycount mirror)](http://wiki.polycount.com/wiki/Defining_the_Rift%E2%80%99s_Visual_Style)
- Tunic, Jusant: [Game Developer, Tunic](https://www.gamedeveloper.com/design/designing-content-for-no-one-an-interview-with-the-team-behind-tunic) ·
  [Jusant tech interview](https://www.dsogaming.com/interviews/jusant-tech-interview-unreal-engine-5-nvidia-dlss-3-shaders-precompilation-more/)

**City, light, fog, reflections**
- Interior mapping: [Joost van Dongen](http://joostdevblog.blogspot.com/2018/09/interior-mapping-real-rooms-without.html) ·
  [Spider-Man technical postmortem (Vault)](https://www.gdcvault.com/play/1026496/-Marvel-s-Spider-Man) ·
  [polycount](https://polycount.com/discussion/204601/interior-mapping-in-spider-man-ps4)
- Matrix Awakens: [80.lv Houdini breakdown](https://80.lv/articles/breakdown-creating-the-matrix-awakens-in-houdini-unreal-engine-5) ·
  [City Sample docs](https://dev.epicgames.com/documentation/unreal-engine/city-sample-project-unreal-engine-demonstration?lang=en-US)
- [c0de517e, Cyberpunk 2077 frame notes](http://c0de517e.blogspot.com/2020/12/hallucinations-re-rendering-of.html)
- [Adrian Courrèges, GTA V graphics study](https://www.adriancourreges.com/blog/2015/11/02/gta-v-graphics-study/)
- [Inigo Quilez, fog](https://iquilezles.org/articles/fog/)
- Lagarde: [Water drop 2b, dynamic rain](https://seblagarde.wordpress.com/2013/01/03/water-drop-2b-dynamic-rain-and-its-effects/) ·
  [3b, wet surfaces](https://seblagarde.wordpress.com/2013/04/14/water-drop-3b-physically-based-wet-surfaces/)
- Impostors: [Fortnite HLOD impostors](https://forums.unrealengine.com/t/hlod-w-impostor-cheaper-better-looking-lod-system-used-in-fortnite/126524) ·
  [three.js octahedral impostors](https://discourse.threejs.org/t/octahedral-impostors-for-three-js/80318)

**Tile GPUs and WebGL**
- ARM, Bjørge, *Bandwidth-Efficient Rendering*, SIGGRAPH 2015: [slides](https://community.arm.com/cfs-file/__key/communityserver-blogs-components-weblogfiles/00-00-00-20-66/siggraph2015_2D00_mmg_2D00_marius_2D00_slides.pdf) ·
  [notes](https://community.arm.com/cfs-file/__key/communityserver-blogs-components-weblogfiles/00-00-00-20-66/siggraph2015_2D00_mmg_2D00_marius_2D00_notes.pdf)
- Apple: [Harness Apple GPUs with Metal (WWDC20)](https://developer.apple.com/videos/play/wwdc2020/10602/) ·
  [Tuning your OpenGL ES app (HSR vs discard/blend)](https://developer.apple.com/library/archive/documentation/3DDrawing/Conceptual/OpenGLES_ProgrammingGuide/Performance/Performance.html) ·
  [MSAA on Apple GPUs](https://developer.apple.com/documentation/Metal/improving-edge-rendering-quality-with-multisample-antialiasing-msaa)
- WebGL: [WEBGL_multi_draw support (web3dsurvey)](https://web3dsurvey.com/webgl2/extensions/WEBGL_multi_draw) ·
  [three.js BatchedMesh example](https://threejs.org/examples/webgl_mesh_batch.html) ·
  [Wonderland Engine, WebGL performance on Safari](https://wonderlandengine.com/about/webgl-performance/)
