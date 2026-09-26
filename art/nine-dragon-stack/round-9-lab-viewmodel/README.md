# Round 9 · lab P8 "viewmodel": the first person, remastered (E169)

Jake (2026-09-25): "polish and remaster and upscale the actual first person — the grappling hook, the weapon, the hands,
the arms — just like absolutely everything, pumped to the max." P8 owns everything held and worn in first person at
rest and in melee. The Fei Zhua's firing (claw deploy, line, zip, impact) is the sibling lab P9's.

- Page: `dev/nd-lab-viewmodel.html`. Code: `src/dev/nd-lab/viewmodel/`. Blender scripts: `src/dev/nd-lab/viewmodel/blender/`.
- Assets: `public/assets/nine-dragon/lab/viewmodel/`, 4.1 MB of GLBs and WebP maps. `plates/` adds 1.4 MB of lab-only
  backdrops; don't integrate those.
- The page draws the viewmodel over a **plate**: a clean-room capture with the weapon off, `plates/<shot>-plate.jpg`, taken
  from `dev/nine-dragon.html` through `__nd` with `weapon(false)`. It then runs a copy of the clean room's bloom and grade
  (`post.ts`), so a lab frame looks the way the clean room will draw it.
- It is driven headless through `window.__ndVm`; there are no URL switches:
  - `ready`, `loaded()`, `shot('loop-1' | 'spawn' | 'stair-street')`, `pixelRatio(r)`, `stats()`, `bench(n)`, `snapshot(w, h, q)`.
  - Motion: `play('light' | 'heavy' | 'parry' | 'draw' | 'sheathe')`, `step(frames, dt)`, `clock(on)` (for deterministic
    captures), `trail('light' | 'ink')`, `plate(on)`.
  - `set(key, v)` keys:
    - layout: `guardX/Y`, `tipX/Y`, `wristX/Y`, `elbowX/Y`, `guardDepth`, `roll`, `wristDepth`, `armRoll`, `elbowDepth`, `fov`;
    - look: `crease`, `wear`, `ao`, `env`, `spill`, `detail`, `emit`, `halo`, `haloPx`, `hullPx`, `linePx`, `sutra`, `exposure`,
      `bloomTight`, `bloomWide`, `keyX/Y/Z`;
    - scene: `breeze`, `walk`, `vm`.
  - Keys for a human at the page: 1 light, 2 heavy, 3 parry, 4 draw, 5 sheathe, W walk.

## What was built, per piece

| Piece | How | Tris | Notes |
|---|---|---|---|
| Blade | procedural, `jian.ts buildBlade` | ~6 k | A 7-point section per side, flat-shaded facets with ruled creases: neon band (15 % of the half width, emit 1.5) → bevel → flat → shallow fuller → ridge. 26 rows, denser near the pointed tip (`(1−u)^0.72`). A hairline ridge highlight. The etch decal (a canvas atlas: cloud scrolls, circuit rulings, 卍 medallion, 九龍 seal) is on the flats. 4.4 cm wide, 76 cm long. |
| Heat shimmer | `jian.ts buildHalo` | 0.4 k | Screen-space ribbons either side of each edge, 7 px × DPR. The outer side is full width and the inner side 0.3×. Two noise octaves drift toward the tip. Additive colour; the target's alpha is left alone. |
| Grip, collar, ring, pommel, blade clip | procedural, `buildGrip` / `buildBladeClip` | ~9 k | A lacquer core. A real cord wrap: 2 × 3 flat cords, 7 turns, per-row radial frames so they lie flat. An 18 cm grip. Brass collar, red silk band, a ringed medallion, a small pommel with its ring, and a brass leaf clip above the crown. |
| Dragon-head guard | **TRELLIS remaster**, `blender/guard.py` | 60 k | From lab P4's 9.4 M-face raw. Maps are in the vertex colours: AO 5 mm, curvature (pointiness), and the TRELLIS texture's luminance. A smoothed macro normal is in TEXCOORD_0 (octahedral). |
| Tassel | Verlet, `cloth.ts Tassel` | 1.7 k | A cord of 4 points, then a rigid knot + brass cap, then 18 strands × 8 points. A bundle spring weakens down the skirt, and a noise breeze moves it. 4 sub-steps. |
| Talisman | Verlet sheet, `cloth.ts Talisman` | 0.1 k | 4 × 10 points: structural, shear and bend constraints (paper is stiff). A flutter noise acts on the lower rows. The 鎮邪 / 敕令 fu decal is on both faces. It hangs from the dragon's back (+x), so it shows beside the grip. |
| Gloved right hand | Blender, hand fork, `blender/hand*.py` | 20 k | A signed-distance hand meshed by OpenVDB at 0.5 mm. The cuff, red trim, gold piping, strap, buckle and knuckle studs are parametric. Maps: AO, curvature, detail (stitches, grain) and object-space normals, at 1024². |
| Right sleeve | Blender, `arm-r` | 8.6 k | Navy cloth with folds, a red trim with gold piping, and a red cord. It rides the glove's cuff axis (see Learning 6). |
| Left fist | Blender, `fist-l` | 12 k | A loose gloved fist that peeks out from under the launcher. It has a 14 mm hole on the thumb side, which can't be seen from the eye. |
| Fei Zhua gauntlet | Blender, gauntlet fork, `blender/gauntlet*.py` | 60 k (claw node 9.5 k) | Sleeve → cream bandage (a shingled helix, two figure-8 passes, loose ends) → a 2-strand red cord with a knot and tassel → a carbon twill shell with red stitching, brass plates with engraving, a 龍 crest, the line drum, a ram, straps and buckles. A 回-fret collar and a cyan muzzle ring. `claw` has three mechanical talons (pin, arm, knuckle, crescent blade). 2048² maps. |
| Slash trail 飞白 | `trail.ts` (Driftwood's `Sword.ts` ribbon is the base) | ≤ 0.6 k | 28 samples × 4 Catmull-Rom subdivisions. Dry-brush hair streaks whose gaps open with age and toward the inner edge, a ragged inner edge that eats in and tapers the tail, and a cyan core on the tip edge. The `light` look is the default; `ink` is kept as a switch. |
| Motion | `viewmodel.ts MOVES` | — | Breathing, a figure-8 walk bob, look lag, light slash, heavy chop, parry flick, draw and sheathe. Keys are hand offsets plus blade **directions** and roll, Catmull-Rom interpolated, pivoting at the hand. The left arm pulls back during a swing. |

One program draws all of it (`materials.ts`), shading by class; each GLB's material name is its class. Built parts get
ruled lines and a steady hull; living parts get a dry-brush hull. The blade's cyan edge lights what is near it through the
neon spill.

## The images

| File | What |
|---|---|
| `final.jpg` | **The side-by-side.** Full frames: target-1 \| the clean room today (P4 viewmodel) \| this lab \| the sutra flip. Then matched crops of the right hand, the Fei Zhua and the guard: target \| clean room \| P8 \| a codex edit of the P8 frame. |
| `motion.jpg` | The motion strip: idle ×3, walk ×3, light slash ×6, heavy ×6, parry ×3, sheathed, draw ×2. Frames at 60 Hz. |
| `plates.jpg` | P8 over three clean-room plates (spawn, stair street, loop-1), with no per-shot retuning. |
| `loop-01…08.jpg` | The loops, each captioned: first assembly · the guard · the Fei Zhua pose · motion v1 vs v2 and the trail looks · the blade vs the bloom · the hands · codex target 1 · codex target 2 → fixes. |
| `codex-t-rest-a/b.jpg`, `codex-t-rest2.jpg` | Codex `image_gen` EDITS of my own frames (the P8 targets). None were re-rolled. |

## Cost

Measured at 1206×2622 on the M5 Max (Metal), with `bench(120)`, median of 3.

| | Draws | Triangles | ms/frame |
|---|---|---|---|
| Plate + bloom + grade only | 10 | — | 1.55 |
| + the viewmodel | 33 (**23 for the vm**, +1 while the trail lives) | 179 k in the meshes, 357 k rasterised with the ink hulls | 1.80–1.96, so **the vm costs ≈ 0.3–0.4 ms** |

- Tris by asset: guard 60 k, gauntlet 59.8 k, hand-r 20.2 k, fist-l 12.0 k, arm-r 8.6 k, and ~18 k procedural (blade, grip,
  cloth, halo, knot).
- CPU per frame: the cloth is 18 × 8 + 4 + 43 points × 4 sub-steps, and the geometry rewrite is ~1.5 k vertices. Both
  are negligible.
- **Phone levers**, if the whole frame goes over budget:
  - Guard 60 k → 30 k: `guard.py --tris 30000`.
  - Merge the sword body with the guard: both are the shared material, so that saves 2 draws.
  - Merge the talisman cord into the tassel's dynamic mesh: 2 draws.
  - The hull could skip the fist.

**Sizes**

| File | Size |
|---|---|
| `guard.glb` | 576 KB |
| `gauntlet.glb` | 572 KB, plus maps 521 KB and normals 773 KB |
| `hand-r` | 210 + 171 + 202 KB |
| `arm-r` | 90 + 158 + 205 KB |
| `fist-l` | 138 + 167 + 208 KB |
| Total | 4.1 MB |

## Learnings

1. **Remastering a TRELLIS sculpt.**
   - What fails:
     - A voxel remesh of either TRELLIS mesh. Neither is watertight, and OpenVDB kept only the closed socket ring.
     - Collapse-decimating the 9.4 M raw. It stalls at 330 k tris on the shell's boundary edges.
   - What works:
     - Subdivide the clean 39 k mesh twice (simple).
     - **Shrink-wrap** it onto the raw (nearest surface point).
     - Only then clip the socket (the back 27 %), then decimate to 60 k.
   - The OBJ importer's axis conversion leaves the raw rotated +90° about X relative to the glb. A nearest-point test found
     it (median 38 mm → 0.1 mm).
2. **Use vertex maps, not an atlas, for a sculpt.** Smart-projecting a TRELLIS head gave ~3 000 islands at 8 % coverage,
   and the seams speckle. At 60 k tris, AO, curvature and texture luminance baked into COLOR_0 carry it with no UVs.
3. **glTF export traps.**
   - A second colour attribute exports as all ones, so the macro normal rides TEXCOORD_0, octahedral-encoded. The
     exporter flips v; `assets.ts` undoes it.
   - COLOR_0 is only written (and kept by `gltf-transform`) when a material reads it: wire a Color Attribute node into
     the base colour.
4. **A painter's light.**
   - The three value bands come from a heavily smoothed **macro normal** (the guard's) or the low-poly surface normal
     (the textured GLBs).
   - The sculpt's or normal map's normal is used only for glints, rims and ink.
   - The result is big readable light and shadow shapes instead of noisy micro-banding.
   - The key light was moved more to the side, `(−0.55, 0.8, 0.22)`, so half of each form sits in shadow.
5. **The bloom veils a black blade.**
   - The clean room's bloom (threshold 1, wide 0.4) turned the blade body mid-grey when its edges emitted 4.2 (loop 5).
   - The fix: keep the edge at `JIAN.emit` 1.5 (an HDR peak of ~2.5: the glow wash plus 1.5× emission) and let a
     screen-space halo carry the glow, 0.3× on the inner side because the glow lives outside the blade.
   - Also keep the blade out of its own neon spill.
6. **Motion.**
   - Key the blade's direction plus the hand's offset, and pivot at the hand. Rotating deltas about the jian origin (the
     guard) flipped the grip over the blade (loop 4, v1).
   - The sleeve's elbow sits on the glove's cuff axis at rest and follows 45 % of the hand's move offset. Its roll comes
     from the glove's back-of-forearm axis, so the cuff never kinks. An elbow placed in NDC kinked the cuff (loop 6).
7. **飞白 on a night street.**
   - Dark ink vanishes against the wet street. The `light` look reads: pale dry-brush streaks, gaps that open with age,
     a cyan tip core, and a taper toward the tail.
   - Every blended effect keeps the target's alpha (alpha factors Zero / One), because the clean room keeps inverse depth
     there.
8. **Codex edits of my own frame return the geometry unchanged** (loops 7 and 8). So the viewmodel's forms are at target
   level, and the gaps were surface:
   - brass should be desaturated, olive, with fewer glints;
   - leather should be matte and pebbled;
   - the wraps should read as linen.
   The fix is object-space noise in metres, so the grain has the same scale on every GLB: leather grain ~1 mm, linen
   fleck, and a brushed patina on brass. The brass palette went from `#b08038` to `#a8834a` and the glove was warmed to
   `#332d2b`.
9. **Baked normals miss at contacts** (studs, buckles, cords: 10–20 % of those texels). The shader blends the map toward
   the surface normal when the two disagree (`smoothstep(0.2, 0.55, dot)`).
10. **Placement.**
    - The Fei Zhua comes from the lower-left corner at ~35°, foreshortened (elbow depth 0.75× the wrist's), so the wraps,
      cord and drum read. P4's near-horizontal pose showed only the collar and claw.
    - The talisman hangs from the dragon's back (+x). Hung from the collar, the glove hid it.
    - The grip is 18 cm and the pommel small. The first 23 cm grip put a large brass bulb at the bottom right.
11. **The hand fork's anatomy note.** With the SPEC's forearm direction d, a real right hand's knuckle row falls on −x (the
    fingers wrap over +z and down +x, the thumb across the back). The SPEC's guess (knuckles on +z) was wrong. The eye
    still sees the finger backs and knuckles, as in comp-B and style A.

## Integration into `src/dev/nine-dragon/` (the lead's files)

1. **Copy the modules.** Copy `geo.ts`, `materials.ts`, `jian.ts`, `cloth.ts`, `trail.ts`, `assets.ts` and
   `viewmodel.ts` into `src/dev/nine-dragon/vm/`. Leave out `main.ts` and `post.ts`: they are the lab's plate and post.
   Move the `*.glb` / `*.webp` from `public/assets/nine-dragon/lab/viewmodel/` to `public/assets/nine-dragon/vm/` and
   point `ASSET_BASE` in `assets.ts` at it. Leave `plates/` behind.
2. **`main.ts`: construction.**
   - Change `import { Viewmodel } from './hero/viewmodel'` to `'./vm/viewmodel'`.
   - Build it with `const vm = new Viewmodel(shared.u.uSilk.value); await vm.load();`. This replaces the
     `loadGlb(guard …)` block.
3. **`main.ts`: `resize()`.** Keep `vm.u.uLinePx` / `uHullPx` / `uRes` as they are, and also set these on every
   `vm.materials` entry:
   - `uRes` = the buffer size;
   - `uPx` = `7 * pr`, the halo's width.
4. **`main.ts`: the frame.**
   - `vm.update(dt, { t, walk, speed, lookVel, hook, aimNdc })`. The `slash` / `heavy` fields are gone.
   - Where the attack input set `slash = 0`, call `vm.play(heavy ? 'heavy' : 'light')`. The parry, draw and sheathe
     inputs call `play` the same way.
   - Every frame: `vm.gravity.set(0, -Math.cos(pitch), -Math.sin(pitch)).multiplyScalar(9.8)`, with `pitch` the player's
     view pitch, so the tassel and talisman hang true.
   - The sutra flip is unchanged: `vm.u.uSutra.value = s`.
   - `muzzleNdc()` is unchanged. The `claw` node hides while `hook` ∈ (0.02, 0.97), where P9's flying claw takes over.
5. **`post.ts`: nothing to change.**
   - The viewmodel still draws in the near depth slice.
   - Its program writes alpha 1, as P4's did.
   - The halo and trail blend colour only.
   - **Don't raise `JIAN.emit` above ~1.5** (an HDR peak of ~2.5), or the clean room's bloom greys the blade (Learning 5).
6. **Rebuilding the assets.**
   - `blender -b --factory-startup --python src/dev/nd-lab/viewmodel/blender/guard.py -- <out> --clip 0.27`, then
     `pnpm exec gltf-transform meshopt`.
   - `hand.py -- --out <dir> --scratch <dir>`.
   - `gauntlet.py -- <scratch>`, then `gauntlet_maps.py <scratch>`.

The asset contract the Blender scripts follow:
- glTF, Y-up, metres; the material name is the class.
- Maps are either COLOR_0 (AO, curvature, detail) or a `-maps.webp` + `-nrm.webp` pair (object-space normals in Blender
  axes).
- Frames:
  - JIAN-local: the grip axis is +y and the flats face ±z.
  - GAUNTLET-local: +y runs from the elbow to the claw hub at the origin; +z is the back of the forearm.
- Attach points: see `ATTACH` in `viewmodel.ts`.

## Not done / next

- **Landscape.** `LAYOUT_LANDSCAPE` still has P4's arm values, and the new sleeve and gauntlet framing is untuned there.
- **Cloth collisions.** The tassel and talisman don't collide with the glove: in a hard slash a strand can pass through
  the hand for a frame.
- **Blend moves into each other.** A combo, or a parry during a swing, restarts from the current key.
- **Pommel and collar.** They are procedural brass without baked maps, so they read flatter than the Blender brass.
  An engraving strip on the lathe UVs is the next step.
- **Left fist.** It has a 14 mm hole on the thumb side, hidden from the eye. The hand fork's contact normals are 10–20 %
  wrong where pieces touch; the shader masks this.
