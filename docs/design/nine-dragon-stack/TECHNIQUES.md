# Nine Dragon Stack: techniques from the other shards (E169 look lab)

This is every look, render and asset technique that the Driftwood, Nalati and Pine Hollow agents built and that could
help the shard-4 clean room (`dev/nine-dragon.html`, `src/dev/nine-dragon/`) reach 界画霓虹 Jiehua Neon
(`ART-STYLE-RESEARCH.md` §4.1, §5). The sources are the code, `docs/`, `project/archive/`, the git log (all branches)
and the Claude Code session transcripts. The method that ties them together is written up in
[`docs/design/LOOK-LOOP.md`](../LOOK-LOOP.md).

Each entry gives **what** the technique does, **where** it lives, **what it cost**, **how it looked**, and **what
shard 4 should do with it**. The clean room may copy ideas, never imports (LAB-RULES).

## 0. Where the clean room stands (round 5, `54d8776`)

- **What is there:**
  - ruled lines in the material (`aFace` + `fwidth`);
  - a depth-silhouette composite;
  - banded silk fog;
  - SDF-free neon atlases (canvas-drawn words);
  - a quarter-res wet mirror with two one-way streak passes;
  - a half-res dual-filter bloom soaked into the silk weave;
  - the sutra flip on one uniform.
- **Cost:** 2.4 ms at 1206×2622 and 91 draws on the Mac.
- **The mockup board** (`art/nine-dragon-stack/round-5-cleanroom/mockup-vs-cleanroom.jpg`) shows what is missing:
  - The facades are flat and sparse: a regular window grid on pale walls. The mockup has a hand-painted clutter of
    signs, cages, laundry, pipes and balconies every metre.
  - The mockup has warm lantern light (reds, ambers) against the cool silk. The clean room is cool and even.
  - Its wet flagstones are a mirror full of colour. The clean room's are faint.
  - The banyan is lumpy low-poly masses, and the people are simple.
  - Nothing sits in the mid-ground layer between 20 m and the fog.
- **A likely render bug, found reading `post.ts`.** The world renders into the MSAA target, then `r.clearDepth()`, then
  the viewmodel renders into the same target. three resolves the depth buffer after **every** `render()` call
  (`resolveDepthBuffer` defaults to true). So `tDepth` ends up holding the viewmodel's depth only, with every world pixel
  at the far plane. The composite's depth silhouette then draws around the jian and the claw, and around nothing in the
  world.
  - The game hit the same bug: `1305f2d` fixed it, see `src/core/worldDepth.ts` (§3.1). It went unnoticed there for
    days while other lanes papered over the symptoms.
  - **The best fix is the game's final one, depth slices** (`b688ef1`): don't clear at all. Draw the world at depth
    ≥ 0.3 and the viewmodel in a near slice, via `renderer.getContext().depthRange(0, 0.075)` around its render and
    `depthRange(0, 1)` after. The depth texture then holds world + weapon with no copy.
    - Remap the silhouette's linear-depth decode for the `[0.3, 1]` world range.
    - It saved 0.11–0.18 ms at 1206×2622 on the M5, and ~45 MB of tile store and reload a frame on the phone.
  - A 1-line stopgap: set `rtScene.resolveDepthBuffer = false` around the viewmodel render.
  - Test every depth reader with the weapon shown and hidden (the Pine Hollow helper's rule).

## 1. Method and measurement

### 1.1 The 9-angle look loop

The full method is in `LOOK-LOOP.md`.

- **What:** the method itself.
- **Where:** `art/driftwood-isle/round-4-remaster/`, `art/pine-hollow/round-14-look-loop/`, `scripts/pine-hollow-views.mjs`.
- **What it cost:**
  - Round 1 took ~70 min wall-clock.
  - With the polling runner, a codex target lands in ~3 min.
- **What it bought:**
  - Driftwood's worst ΔE00 went 16.0 → 5.8.
  - Pine Hollow's sky went 14.8 → 4.2.
  - The gaps went to owners as ranked, countable rows.
- **Shard 4:**
  - Anchor it at the spawn P in Lantern Square.
  - FP 1–4 at 1206×2622 with the HUD.
  - 5 TOP down into the Well.
  - 6–9 DIAG from 45 m, which in this stacked city means across and up the canyon.
  - Freeze time through `__nd.time(6.5)` and keep the cameras in a `cameras.json`.
  - The "up the Well" and "down the Well" views are the shard's signature (高远 / 深远), so add them as frames 10–11.

### 1.2 Paint-over targets: an edit of **your own** frame, not the concept

- **What:** codex repaints the engine's exact frame in the target style. It KEEPS the camera, the layout and the HUD, and
  CHANGES only the rendering. The target is then reachable by the geometry you have.
- **Where:** `scripts/nalati-paintover.mjs` (the prompt shape is in LOOK-LOOP §3), `art/nalati-grasslands/round-5-paintover/`.
  - Driftwood and Pine Hollow called the same thing "remaster mockups".
- **What it cost:** one codex run per frame. Local Qwen takes ~30 s (`scripts/mockup-local.sh`).
- **What it looked like:** the parity sheets showed engine | paint-over | mockup side by side.
- **Nalati's lesson:** the concept mockups are **stretched ~1.44×**. Take the layout from the capture, never from the
  mockup.
- **Shard 4:** the round-6 mockups were painted from Driftwood's HUD frame, not from the clean room's geometry.
  - Paint-over *each lab capture* with the §6 prompt-A paragraph first.
  - Then diff against that target, not against round 6.

### 1.3 ΔE00 per palette region + the learned LUT

- **What:**
  - `scripts/palette-delta.py` gives the mean colour per material region, mockup vs game.
  - `scripts/fit-lut.py` warps a 33³ LUT from Lab Reinhard pairs per region, with identity anchors.
  - The runtime is `src/world/lut.ts` (`LUT3DEffect`, last in the grade).
- **Where:**
  - Driftwood X1 `ec47cbe`.
  - Pine Hollow PH-L4 `c393380` / `bee0c6b`.
  - `scripts/palette-regions/*.json`.
- **What it cost:** a 144 KB file and one LUT3D fetch in an existing pass (~0.1 ms).
- **What it looked like:** sand 4.4 → 0.2 and grass 4.6 → 0.4 on Driftwood. On Pine Hollow every region came in under 6
  over 54 frames.
- **The limit:** it moves colour, not structure. Driftwood stayed "~70 % parity" with a perfect palette.
  - Jake on the LUT's before / after: *"What does color grade do I can't tell."* Don't lead a board with it.
  - A refit is global. Pine Hollow's six-zone refit pushed the Hollow's rock 4.6 → 6.2.
  - Nalati's advice: hold the sky at identity so the fog-to-painting match survives.
- **Shard 4:** the style bible already plans "the existing LUT, authored per stratum".
  - Fit **one LUT per stratum** from paint-over targets vs LUT-off captures.
  - Regions: silk / fog band, ink wash (lit), ink wash (shade), mineral accents (azurite, malachite, cinnabar), wet
    ground, and neon (weight 0, or excluded: never let the LUT learn the bloom).
  - Keep `greyAnchor` high (3). Silk and ink are near-grey, and the LUT must not tint them off-hex.

### 1.4 SSIM against goldens, and the run-to-run floor

- **What:** SSIM of a frozen pose vs its golden, with creatures masked. KTX2 A/B boards judge SSIM / PSNR **against the
  run-to-run floor** (two loads of the same build), not against zero.
- **Where:**
  - `scripts/scorecard.mjs`, `docs/design/scorecard.md`.
  - `scripts/ktx2-ab-board.py` (E157 `bdb9f70`: Pine Hollow frame SSIM 0.92–0.9x).
  - A charging elite once made the SSIM between two runs of the same build 0.22 (`09e6272`).
- **Shard 4:**
  - Use it as the regression guard between lab loops: a lab change must not move the frozen spawn frame except where
    intended.
  - Paint-over targets are not pixel-aligned, so use **edge-density per region** as the density ruler. That ruler is
    new; §8 has the sketch. Palette-delta is the colour ruler.

### 1.5 The clean-room precedent: Nalati's one-file prototype, and Jake's hard rules

- **What:** a clean-room agent saw only the 9-angle sheets and built `dev/nalati-cleanroom/` (`247572c`, one-file three.js).
- **What it found, in order of payoff:**
  1. paint everything far;
  2. fog colour sampled from the painting;
  3. values ~35 % darker, olive;
  4. a lighting cheat;
  5. GPU density with no per-instance storage;
  6. baked shadows and contact darkening;
  7. layout from the capture.
- **What it cost:** 124 calls and 369 k tris on the phone tier, 1.7 ms on the M5. It became Nalati's render path
  (`src/nalati/look/`).
- **Its best phone setup:** no post chain at all. The grade ran inside every shader, with canvas MSAA ×4 plus
  alpha-to-coverage.
- **Jake's verdict** after playing it: *"such a cheating asshole lol, so many cardboard cut outs … it only looks good
  for screenshots … when you move around you can see its a scam"*, *"the fucking skybox transition"*, and *"the grass is
  not bad"*.
  - The agent's own diagnosis: *"the prototype was judged from one camera, so it cheated for that camera."*
  - The prototype was dropped from the tree (`5444130`).
- **His hard rules** (`docs/design/nalati/look-pass.md`):
  1. No cutouts, billboards or sprites in the playable 500 m. An impostor is allowed only as a distance LOD of a real mesh
     past ~120 m.
  2. Painted imagery only at true infinity, as ONE seamless panorama. Never paint the mid-ground.
  3. Validate by moving: the 9 angles **and** a 12-frame walk-around.
- **Shard 4:** the city's far canyon walls are *not* infinity. They are 60–300 m of real, climbable architecture.
  - Only the Crown's sky, and whatever lies past the stack's outer shell, may be painted.
  - Sign boards, laundry and cages must be geometry, even as thin quads on a real wall.
  - Test every lab with a walk-around strip, not only the 4 frames.

## 2. Line and edge techniques

### 2.1 In-material ruled lines

- **Where:** the clean room's `kit.ts` / `style.ts` already do it: face-local UV in metres, `fwidth` antialiasing.
- **No shard ever shipped a line of any kind**: no outline pass, no inverted hull, no Sobel. The only mention in the
  session logs is an outline suggested as a selection highlight in the Explorer. Driftwood's style pick said it outright:
  "no textures … no outline pass". So the clean room's line cost numbers are the first in the repo; measure them.
- Driftwood's `lowpolyKit` has the idea that transfers: detail costs
  triangles, never draw calls, because every static prop is one merged, non-indexed mesh on one material.
- **Shard 4:** keep the ruled lines, and add a **distance ruling LOD**.
  - Ruling rows thin by distance band, and a line fades into wash below ~0.7 px (§5.2).
  - Driftwood's GroundCover E117 fade shows how: every item has its own edge in [near, far], so detail thins over
    ~25 m instead of stopping in a ring. Give each face's detail rows a hashed fade distance.

### 2.2 Screen-space outlines: which ones were tried

- **The depth-silhouette composite** (clean room): see the bug in §0.
- **Kuwahara painterly filter** (Nalati v1, `182301d`; deleted `1a6059c`):
  - It cost ~2 ms at 1600×900.
  - The look-director's verdict: *"it smears the felt ornaments and grass tufts into watercolour, and the mockups are
    crisp."*
  - Shard 4: **don't**. Jiehua is crisp ruled line; a Kuwahara filter destroys exactly that.
- **The terminator edge band** (Driftwood `stylize.ts`: a thin warm, saturated band on the lit / shade edge):
  - It failed a blind iPhone A/B (*"these shadows look the same on both sides"*), and Jake had it removed permanently
    (E145 `8312b90`: "no orange rim round cast shadows").
  - Lesson: a saturated line that follows the lighting reads as an artefact. In Jiehua, lines follow **geometry**, never
    light.

### 2.3 Brush outlines for living and held things

- **Recommended, not yet built anywhere:** an inverted hull (backface, pushed along the normal) with a dry-brush strip
  alpha (§4.1 "Enemies").
- **The nearest existing pieces:**
  - The rig bake (`src/entities/creatureRigBake.ts`, `scripts/creature-rig-bake.mjs`): a static hull skinned to a
    procedural skeleton. A hull mesh is exactly what an inverted-hull outline needs.
  - The Nalati melee kit (`src/player/meleeGeo.ts`): smooth indexed tubes with per-vertex paint, which give clean normals
    for the push.
- **Shard 4:** after the §0 fix, draw the jian and the claw with their own hull. That is the 6–9 px brush weight of the
  line table.

## 3. Viewmodel (first-person weapon) techniques

### 3.1 The depth clear, done right

- **Where:** `src/core/worldDepth.ts` (`WorldRenderPass`), fix `1305f2d`.
- **What happened:** every viewmodel draws a clearer at renderOrder 999 that calls `clearDepth()`, so the weapon (1000)
  never clips into walls. The post chain read the composer's depth *after* the pass, which held the weapon alone.
  - The AO shaded only the weapon.
  - The fog march integrated 120 m through walls.
  - The god rays shone through rock.
- **The fix, first version:**
  1. Blit the world's depth before the first clear.
  2. After the pass, merge the viewmodel's depth over it: one full-screen depth-only draw, LESS.
  - Cost: +1 draw, only while a viewmodel cleared.
- **The fix, final version (E142, `b688ef1`): depth slices.**
  - Each clear becomes a move of `gl.depthRange` to the next near slice (`[0.225, 0.3]` … `[0, 0.075]`), and the world
    stays at ≥ 0.3.
  - No copy, no merge draw. On a tile GPU the mid-pass blit had ended the scene pass.
  - The world is pixel-identical; 0.01–0.03 % of weapon pixels round differently.
- **Shard 4:** the same trap is in `post.ts` today (§0). Use depth slices from day one: one `depthRange` call around
  `r.render(vmScene, …)` in place of `r.clearDepth()`, and the silhouette decode remapped.

### 3.2 Framing and FOV

- **Where:** `20856c1` (Driftwood 0.6: the sword sits low-right on a portrait phone, blade tipped forward, tip below the
  crosshair).
- The game's portrait vertical FOV is **93.8°**, Hor+. The bow and sword viewmodels are tuned for it.
- **Shard 4:** the mockups put the jian diagonally lower-right with the tassel in frame, and the claw lower-left.
  - Match the 93.8° FOV, or the look-loop FP frames won't line up with the game's.

### 3.3 Viewmodel materials

- **Shared lit programs:**
  - `Crossbow.viewmodelMaterial` for PBR.
  - The painterly `meleeMaterial` in the transparent queue, for the depth-clear trick.
  - Faceted vertex colours for Driftwood's `Sword.ts` / `Hands.ts`.
- **Procedural textures** are drawn in a worker (`src/player/viewmodelTextures.ts`): ~290 + 180 ms of main thread moved
  off.
- **Shard 4:**
  - The jian's neon edge wants its core colour > 1 into the bloom.
  - The 飞白 flying-white trail is the sword-trail ribbon, §5.3.
  - The brass claw wants the one real specular in the frame.

## 4. Light, shading and colour

### 4.1 One program for a whole shard

- **Where:**
  - `src/world/painterly.ts`: every painterly mesh shares ONE program. The cache key is the constant `'painterly'`,
    everything else is a uniform, vertex colours are always on.
  - `114b4b3` gives every plain material the same map slots (89 → 83 programs).
- **Why:** each extra program is a ~150 ms Metal compile on the iPhone, and a state switch per frame.
- **Shard 4:** `jiehuaMaterial` is already one program. Keep neon, sky screens, rain and steam as few programs as
  possible, and count programs per lab (`renderer.info.programs.length`) before and after.

### 4.2 Toon two-band ramp as one chunk patch

- **What:** Driftwood's `src/world/stylize.ts` patches `lights_physical_pars_fragment` once, so every Standard / Physical
  material on the shard gets:
  - a two-band sun ramp;
  - coloured (violet-lifted) shade, never black;
  - a rim on vertical faces only (never on the ground, where far facets graze).

  A material opts out with a `NO_TOON` define.
- **Where / cost:** `c92bccb` locked it in, at no extra program.
- **Jake:** picked D1, "toon two-band ramp + coloured shadows + rim".
- **Shard 4:** the style bible's two hard bands from a cool top light is this model with the sky screens as the key.
  - Generated props (TRELLIS GLBs on MeshStandard) could share the lighting through the same one-patch trick instead of a
    second material.

### 4.3 The lighting cheat

- **What:** Nalati's `src/nalati/look/light.ts` lights objects by a key swung ~40° round and ~15° higher than the painted
  sun, so the foreground reads front / side-lit while the sky keeps its sun.
- **Where:** `0969ba4`.
- **Shard 4:** there is no sun. The key is the sky screen above.
  - In the canyon a pure top light leaves the facades you look at in the shade band.
  - Tilt the top light ~20–30° toward the camera's facing wall per stratum, the way Nalati did.

### 4.4 A grade with an exact inverse, so painted or hex colours display as authored

- **What:** Nalati's `src/nalati/look/grade.ts`: one grade function (filmic shoulder, saturation, cool shadow / golden
  light split, mild S-curve), plus its exact GLSL and CPU inverse (`V2_UNGRADE`). The painted dome and the fog write the
  scene-linear value that the grade maps back onto the painting.
- **Where:** `f1a7540`.
- **Cost:** none. It is the only effect in the chain.
- **Shard 4:** silk is a **palette hex** (`#8e9bb5` blue-hour silk and so on).
  - Run the fog and silk colours through the inverse of the clean room's shoulder, so the displayed fog *is* the hex.
  - Do the same for the sky-screen painting.
  - Otherwise every tonemap tweak drifts the silk off-palette, and the LUT has to chase it.

### 4.5 Bloom only above 1.0

- **Where:** Driftwood L5 `368e317`: threshold 1.0, knee 0.08, intensity 0.4, so only real highlights bloom. Sand and
  white clouds stay crisp.
- **Shard 4:** the silk is near-white, so it is the Driftwood sand problem again.
  - Only neon at ×4–8 HDR goes over 1.0.
  - Keep lit silk ≤ 0.9 scene-linear.
  - The clean room's Karis-weighted prefilter is right: one hot pixel won't flicker.
- **NaN guard (E91 `69df233`):** one NaN pixel smeared by bloom draws a black square. Clamp every `pow(1 − N·V)` base.
  - It showed on iPhone precision and never in headless Chrome: the iOS gas giant, Pine Hollow's splat, and once
    Nalati's whole desktop frame.
  - `scripts/pine-hollow-nan-scan.mjs` scans 45–90 cameras for non-finite pixels. Copy it for the lab's shaders.
- **Phone budget:** Nalati's phone runs with **no bloom at all**, so no shipped shard has measured a phone bloom yet.
  Neon bloom is shard 4's signature, so give it its own phone number: the clean room's half-res dual filter at 804×1748.

### 4.6 A fixed light pool

- **What:** `src/fx/LightPool.ts`. three bakes the *number* of lights into every lit program, so adding or hiding one
  mid-play recompiles everything: a multi-second hitch on iOS. The pool creates its lights at boot and seals on the first
  render. After that it drives intensity only.
- **Where:** `3b24464` (the rifle's muzzle light: programs 76 → 113 → 76 → 76).
- **Shard 4:**
  - Lanterns near the player plus the jian's edge: ≤ 4 pooled point lights.
  - Neon spill everywhere else is **baked into vertex colour** at build time (§6.1).

### 4.7 Wetness as one uniform

- **What:**
  - Pine Hollow's `uWet` (`src/world/Atmosphere.ts`): porous up-facing surfaces darken and turn glossy, and metals don't.
  - Nalati's `uPWet` (`182301d`) does the painterly version: darker paint plus a sky sheen.
- **Shard 4:** the clean room's "wet = silk value −25 %" is this. Make it a uniform with an up-facing mask, so stairs,
  balcony tops and awnings wet and walls stay dry.

## 5. Fog, air, sky and reflections

### 5.1 Fog coloured from what is behind it

- **What:** Nalati's `src/nalati/look/fog.ts` looks the fog colour up in a 256×1 LUT over azimuth, taken from the
  painting's band just above the horizon and run back through the grade's inverse. The 3D world dissolves *into* the
  painting, with no step at any angle.
- **Where:** `d05788b`.
- **Shard 4:** make the banded silk fog a **1-D LUT over height**, not over azimuth. It holds the colour script of §4.1,
  and the same LUT paints the Well's far layers, so looking down the Well you count the bands.
  - Lines fog first: multiply the line alpha by `(1 − fog)²`.

### 5.2 Painting only at infinity: the horizon matte

- **What:** `src/world/HorizonMatte.ts` (Driftwood X4 `676c869`, Pine Hollow PH-L5 `4a07926`) is a 360° strip painted by
  codex over real in-game captures at six headings.
  - **Chained** (`scripts/horizon-matte/overlap.py`): each segment continues its painted neighbour. Independent edits cut
    a mountain range with a seam.
  - Keyed off the sky (`key.py`, `skyline` mode).
  - Encoded scene-linear through the tonemap's inverse (`encode.py`).
- **Cost:** 1 draw, unlit, fogless; 146–321 KB per strip. Net −2 phone calls on Driftwood.
- **Pitfalls:**
  - The first stacks were ~3° tall, unreadable at phone width. Go to ~10°.
  - codex shifted 4 of 6 night segments by 32 px. Phase-correlate them to the day strip.
  - Nalati's panorama had a 1-px seam due north. The fix padded 16 wrap columns, resized as a loop and cross-faded
    (`3daa25d`).
  - Jake still said of a far blend: *"This is not smooth at all … one paint ends and another starts."* Seams are what
    he sees first.
- **Jake:** *"Painted horizon lock it in and default no toggle."*
- **Shard 4:** usable only for what is truly outside the stack.
  - The Crown's night sky and the far mountains seen from it.
  - The "real sky" strip at the top of the Well.
  - The LED sky-screen content (a 青绿 landscape at a coarse pixel pitch), which is diegetic, so it is not a cheat. Paint
    it by codex from 千里江山图 crops at the screen's aspect, then quantise it to the LED pitch in the shader.

### 5.3 Streaks, trails and ribbons

- **Wet-ground streaks:** the clean room already has a mirror + a one-way smear. The mockups' streaks are **longer,
  brighter and colour-saturated**.
  - Bias the smear toward the camera (screen-down) and raise the streak gain on emissive only.
  - Clip the reflection under ~0.3 of the source luminance, so the silk stays pale.
  - The research's alternative is cheaper: an additive vertical card per sign on the ground under it.
- **The sword trail** (Driftwood C4 `16ce11f`):
  - One additive camera-space strip from a ring of blade base / tip samples, one draw.
  - 3 Catmull-Rom sub-quads per gap, so a 60 fps slash is an arc, not an 8-segment polyline.
  - The inner edge is feathered, with a bright core line at the tip.
  - Shard 4: this *is* the 飞白 flying-white ribbon. Swap the feather for a dry-brush strip texture (256×64) scrolling
    along the ribbon, and fade it cyan → ink.
- **Pooled impacts** (`src/fx/Impacts.ts`): one InstancedMesh of 128 chips, one draw, precompiled at boot.
  - Shard 4: the 泼墨 ink-splash decals and the cinnabar seal-stamp telegraphs, as a pooled instanced quad set.

### 5.4 Reflections without a second scene render

- **What:** Pine Hollow's pond (`src/world/waterSurface.ts`, PH-L9) reflects the environment and swaps in an analytic
  **skyline probe**: a 1-D texture, per azimuth, of the tallest occluder's height and distance, intersected per pixel as
  a cylinder. The planar mirror stays only as the "before" (`?pond=planar`).
- **Shard 4:** the square's wet flagstones could reflect a **skyline probe of the facades** (per azimuth: the roofline
  height and distance, the facade's mean wash) plus the reflection cards for neon.
  - That drops the quarter-res scene render (the clean room's pass 1).
  - Measure first: the mirror may be cheap at quarter res.
- Dropping the pond's planar re-render took that pose from 161 to 127 calls.
- Pine Hollow's rain puddles reuse the water program (+2 draws, +1 program, compiled at boot).
- Nobody in the repo built SSR, and nobody needs it here.

## 6. Density: facades, clutter, props

### 6.1 Merged kits with baked AO and baked light

- **`src/world/lowpolyKit.ts`:**
  - One merged, non-indexed mesh per prop or building on one material.
  - `bakeAO`: per-face hemisphere rays through a coarse occupancy grid darken each face toward a cool shade. It takes
    ~5–20 ms per 10 k tris, once at build.
- **Blender + Cycles** (`scripts/blender/`, Driftwood X2 `dd5edf1`):
  - Terrain AO plus the sun's indirect bounce, baked to WebP lightmaps.
  - Per-prototype AO in the vertex-colour alpha.
  - 60 prototypes, 13 k placements merged into 2×2 tiles.
- **Shard 4:**
  - Bake **neon spill** the same way: per face, a sum of nearby sign colours × a falloff, and AO under balconies and
    awnings, into the vertex colour.
  - This is the style bible's plan, and lowpolyKit's per-face bake is the code to copy: the face stays one colour, so the
    wash stays flat.

### 6.2 Density with no per-instance storage

- **What:** Nalati's grass (`src/nalati/look/grass.ts`) draws each ring as one instanced draw of world-snapped tiles. A
  blade's root is `tile origin + cell(gl_InstanceID) × spacing + hash`, and the CPU writes only the visible tiles'
  origins into a small float texture. Flowers are camera-facing SDF heads, with no texture bytes.
- **Cost:** 5 draws for all grass and flowers; the camp at 97–120 calls on the phone.
- **Shard 4:** the facade clutter (air-con boxes, window cages, laundry, sign boards, pipes) is a *field* too.
  - An instanced draw per clutter kind, placed in the vertex shader from `gl_InstanceID` + the wall's bay grid (a data
    texture of bays).
  - Hundreds of boxes per wall at one draw per kind, the same "one program" rule.
  - They are real geometry, not sprites, so they pass Jake's cutout rule.

### 6.3 Dissolve, don't pop

- **Where:**
  - E94 `cbbd51c`: lo → impostor over 118–130 m with complementary dither.
  - E117: per-item edges in [near, far].
  - `coverTint.ts` E156: the far ground takes the plants' colour by view angle, so the near plants fade into it.
- **Shard 4:**
  - Past ~40 m, facade clutter should fade into the wall's wash colour, the mean of what it hides.
  - Lines fade to 淡墨.
  - The coverTint idea transfers directly: a per-bay "clutter colour" that the far wall shows.

### 6.4 Image → 3D (TRELLIS.2) with palette quantisation

- **Where:** `scripts/img2mesh/` (README). The pipeline:
  1. codex reference (one object, white background, 3/4 view; a sheet needs `split_sheet.py`, or TRELLIS piles the
     objects up);
  2. `trellis_batch.py` under the model lock;
  3. Blender post `driftwood_post.py`: weld, decimate, then **per-facet colour from the texture with k-means `--quant`**,
     and Cycles AO in the vertex alpha;
  4. meshopt.
- **Cost:** 1–3.5 min per prop plus an ~85 s pipeline load.
  - Driftwood's hero props came in two ~15-min batches.
  - Nalati made 18 models in round 5 (`d062b26`).
- **Pitfalls:**
  - Open single-sided shells (the wreck's planks) tear under every decimator.
  - TRELLIS leaves see-through gaps in boulders.
  - One seed made two crossed canoe hulls (`cc12bb0`: seed 7 fixed it). Try 2–3 seeds.
  - Thin parts come out mangled: rifle rails, blade edges, cage bars. Build them in code.
  - `trellis-mac/setup.sh` printed "Setup complete" while every Metal package had failed to build. Check the import.
  - Meshopt-quantised positions shrank models into a 2 m box until the loader was fixed. Check the scale after the
    build.
  - Hunyuan3D-2 is **not for this game** (its licence bars the EU, UK and South Korea).
- **Shard 4:**
  - Candidates: the banyan, the paifang's dragon hooks, the mahjong table and stools, the gondola, the people, the Fei
    Zhua claw.
  - Quantise to the §5.1 palette: `cc0_export.py`'s per-face CIELAB snap is the palette-snap step.
  - They get silhouette lines only (the style bible's rule for generated props).
  - Plain face UVs don't exist on them, so no ruled interior lines.

### 6.5 Rigging generated hulls

- **Where:** `src/entities/creatureRigBake.ts` + `scripts/creature-rig-bake.mjs`. A static image-to-3D hull is skinned to
  a procedural species skeleton (weights transferred from the nearest bones) and written as `.rigged.glb`.
- **Used for:** Nalati `b14c7cc`; Pine Hollow PH-M1 `49e6bb0` (deer, boar, elk, bear).
- **Shard 4:** brush-drawn enemies and the square's people. Generate a hull, rig it to a humanoid skeleton, and animate
  it on twos.

### 6.6 Precompute at build time, not at launch

- **Where:**
  - `scripts/bake-cards.mjs`: GPU-rendered branch-card atlases baked headless and committed.
  - `scripts/bake-textures.mjs`: every procedural canvas texture baked with a source hash.
  - `scripts/bake-ktx2.mjs` (E157): UASTC for colour and normals, ETC1S for ARM.
- **Shard 4:** the neon atlases are drawn on a canvas at load (2048×4096 mono + 1024² colour). Once the words are final,
  bake them to files the same way.
  - Keep the mono atlas uncompressed R8, or as an SDF. Block compression smears thin tube strokes.
  - KTX2 cuts both ways:
    - Pine Hollow rejected it: the files got bigger, ETC1S ~1.5× and UASTC ~6×.
    - Nalati kept it for GPU memory: 97.7 → 64.8 MB.
    - Decide per texture: the silk weave is a good candidate, and the line atlases are not.

### 6.7 Fill rate is the phone's real limit (E142 / E143)

- **What happened:** Jake's iPhone read *"14 fps 71 ms"* on Pine Hollow.
  - Alpha-card overdraw was **20.5 layers per pixel**. Cutting density took it to 9.0.
  - Headless 4×-CPU runs hid it completely.
  - Dynamic resolution was tried and deleted (Jake: *"complete bullshit hack"*; 1.5× render scale was "really bad and
    blurry"). The phone renders at 2×, full stop.
- **Shard 4:** these are all stacked translucent layers along one view ray down a canyon:
  - silk fog sheets;
  - rain;
  - steam;
  - laundry and net cards;
  - neon glow quads;
  - the reflection cards.

  Count overdraw per lab: render the transparent pass with additive 1/255 into a counter target. Keep the Well-down view
  under ~6 layers, and make fog analytic in the material, not sheets, wherever you can.
- **Measure by toggling, not with timer queries:** the browser GPU timer query is wrong on this Mac. Pine Hollow found
  its levers by switching each one off:
  - render scale 0.75 −34 %;
  - the forest −26 %;
  - no shadow redraw −13…−19 %;
  - SMAA −4 %;
  - bloom, god rays and fog −2…−5 % each.

## 7. Workflow lessons that cost time

- **Style that the engine hits at 100 %** beats the best slide (`docs/HOW-DRIFTWOOD-GOT-BUILT.md` §1). Jiehua was
  chosen for that reason: line and flat wash are cheap to do exactly. Keep it that way.
- **Paint-over drift:** the local Qwen greys toon palettes and re-composes with several refs. Use codex for measured
  targets.
- **Clean exports for every before / after.** A render fix landing mid-round moved Pine Hollow's trail ΔE.
- **Quiet-machine fps.** Under other lanes' load, HEAD and the change both read 18–30 ms.
- **Taste is Jake's.** Every stylistic variant is switchable (Settings ▸ Debug, or `__nd.style()` in the lab) and goes on
  one A/B/C board.
- **Mockups can't find render bugs.** For pop-in, flicker and depth bugs, show real frames with a toggle.
  - E156's pop-in took five failed fixes that only changed how plants entered the camera bubble. The one that worked
    changed what the far ground *is* (the 4 m cover-colour grid).
- **Jake on process:**
  - *"desktop mockups are way too tough for me, can you do portrait only"*: boards are iPhone portrait.
  - *"figuring out in game is a pain … just show me … screenshots"*: he picks from boards, not in-game toggles.
  - *"They all look the same use the cheapest versio[n]"*: when variants tie, ship the cheap one.
- **Shared uniform objects bite the one-program rule.** A pickup orb that shared the rifle's material tinted the held
  rifle cyan. Give every per-object colour its own uniform or vertex colour, never a shared material you mutate.
- **Flat attributes differ by API.** WebGPU takes the first vertex of a triangle and WebGL the last, so the faceted
  terrain's WebGPU port had to rotate its indices. It matters only if the lab ever tries `WebGPURenderer`.
- **The shared dev server is not a capture source.** Other agents' WIP crashed boot and reloaded pages mid-shot.
  Capture from a clean export on your own port.

## 8. A new ruler worth adding: detail density per region

The LUT closes colour. Nothing measures the "sparse vs dense" gap, which is the round-5 clean room's biggest one.

A sketch:

1. For each palette region, compute the fraction of edge pixels (Canny on luma, the same thresholds for capture and
   target, both downscaled to the phone's 402-px width).
2. Report `target / capture` per region.
3. Aim for 0.8–1.25.

It is cheap PIL / numpy next to `palette-delta.py`, and it tells a density lab whether a clutter pass moved the frame
toward the painting or into line soup.

## Apply these first (ranked for the clean room)

1. **Fix the silhouette's depth with depth slices** (§0, §3.1, `b688ef1`). Use `gl.depthRange` for the viewmodel
   instead of `clearDepth()`, and remap the decode. It is a few lines that turn on the whole world-silhouette layer, and
   it is cheaper than the copy. Then give the jian and the claw an inverted-hull brush outline.
2. **Run the look loop on the clean room** (LOOK-LOOP.md):
   - 9 frozen angles + up / down the Well;
   - codex **paint-over of each capture** with prompt A;
   - gap lists and a TOP-10 per round;
   - palette-delta per region.
   Measure against reachable targets, not round 6.
3. **Facade clutter as instanced fields** (§6.2): cages, air-con, laundry, signs and pipes placed in the shader from bay
   data, one draw per kind, with a fade into the wall wash past ~40 m (§6.3). This is the biggest visible gap.
4. **Neon spill and AO baked per face into vertex colour** (§6.1, lowpolyKit `bakeAO`), plus ≤ 4 pooled lanterns
   (§4.6). This brings the warm pools of light the mockup has.
5. **A per-stratum learned LUT** (§1.3), fitted from paint-over targets vs LUT-off captures. Exclude neon, keep
   `greyAnchor` 3.
6. **Fog and silk through the grade's inverse** (§4.4), and the fog colour from a 1-D height LUT of the colour script
   (§5.1), so the bands *are* the palette hexes and the Well reads as counted bands.
7. **Stronger wet streaks** (§5.3): emissive-only gain, longer smear, clip under the source.
   - Or reflection cards per sign.
   - Or a skyline probe instead of the mirror pass (§5.4), measured.
8. **Bloom threshold ≥ 1.0 with a tight knee** (§4.5). Only neon blooms, the silk never whites out, and NaN pows are
   clamped.
9. **TRELLIS for the organic hero props** (banyan, people, claw, gondola; §6.4), palette-snapped per face,
   silhouette-lined only, rigged via the rig bake for people (§6.5).
10. **The 飞白 trail** from Driftwood's Catmull-Rom sword ribbon with a dry-brush strip (§5.3), and pooled ink-splash /
    seal decals (Impacts). The first-person frame is where the brush half of the style lives.

The guards on all of them:

- Jake's Nalati rules: no sprites in the playable space, paint only at infinity, and validate by walking (§1.5).
- Overdraw counted per lab, because fill rate is the phone's limit (§6.7).
- Programs counted per lab (§4.1).
