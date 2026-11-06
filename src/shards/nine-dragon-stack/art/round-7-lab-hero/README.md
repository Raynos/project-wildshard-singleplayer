# Round 7 · lab P4 "hero": the weapons and the hero props (E169)

The brief: the things the eye lands on first read as toys in the clean room — the Neon Jian and the Fei Zhua in first
person, the paifang, the banyan, a mahjong table with players, the crowd. Make them read like the mockups, in Jiehua
Neon: built things ruled, living things brushed.

- Page: `dev/nd-lab-hero.html`. Code: `src/dev/nd-lab/hero/`. GLBs: `public/assets/nine-dragon/lab/` (meshopt, 366 KB).
- The page renders through `src/dev/nd-lab/hero/base/`: snapshot copies of the clean room's `kit.ts`, `style.ts`,
  `post.ts`, `signs.ts` and `util.ts` (2026-09-25), so a lab frame looks the way the clean room will. The only change
  in `base/` is the depth slices in `post.ts` (see Learning 8). Don't integrate `base/`.
- Driven headless through `window.__ndHero` (no URL switches): `ready`, `shot(name)`, `set(key, value)`,
  `guard('guard' | 'procedural')`, `vm(on)`, `world(on)`, `pixelRatio(r)`, `stats()`, `bench(n)`, `snapshot(w, h, q)`.
  - Shots: `spawn`, `wide`, `gatecmp`, `banyancmp`, `mahjong`, `hook`.
  - `set` keys: every `VmLayout` field (`guardX`, `tipY`, `roll`, `wristX`, `elbowDepth`, …); `guardLen`, `guardDx`,
    `guardDy`, `guardTilt`, `guardClip`; `banyan` (0 procedural, 1 TRELLIS-trunk hybrid); `crowd` (1 TRELLIS people,
    0 procedural); `sutra` (0…1); `clearDepth` (1 = the clean room's depth clear, for the A/B); `hullPx`; `bloom`; `lines`.

## What won, per piece

| Piece | Won | Why |
|---|---|---|
| Jian blade, collar, grip, tassel, talisman, gloved fist | **procedural** (`weapon-parts.ts`) | A hexagonal blade with the neon edge as a thin emissive band on the outer bevel: black body, crisp cyan-white edges. |
| Dragon-head guard | **TRELLIS** (`guard.glb`, 3.0 k tris after the socket clip, 100 KB) | It reads as a sculpted head. The procedural one (`buildGuardProcedural`, kept as the fallback) reads as a toy: tentacle horns and a glowing eye. |
| Fei Zhua: gauntlet, talons, cloth forearm, red cord | **procedural** | TRELLIS made a beautiful raw gauntlet. Decimation to 5 k tris destroyed it: the talons and straps are thin loose parts, so they were dropped as crumbs or collapsed into a lumpy tube (`trellis.jpg`). |
| Paifang | **procedural** (`paifang.ts`) | Built means ruled. `curvedRoof` makes concave slopes with flying corners, a painted eave board, chiwen, curled hip ridges and a gold-framed plaque. |
| Banyan | **procedural** (`banyan.ts`, canopy v4) | The TRELLIS canopy came back as leaf flakes. Its trunk works in a hybrid (`set('banyan', 1)`), but the decimated facets draw silhouette scribbles. |
| Crowd: walkers with umbrellas, mahjong sitters | **TRELLIS** (`walker.glb`, `sitter.glb`), instanced, two tones each | They read as people: caps, jackets, posture, umbrella canopies. The procedural `person()` reads as a mannequin (`loop-15.jpg`). |
| Mahjong table | **hybrid**: procedural table and tiles (`figures.ts mahjong`, `stools = false`) + TRELLIS sitters, which bring their own blue plastic stools | — |

## The images

- `final.jpg`: target (round-6 style A) | the clean room today (round-5) | this lab. Full frames on top, then matched
  crops of each hero piece.
- `loop-01…07.jpg`: the viewmodel loops (capture next to the target crop). `loop-08…10`: the paifang.
  `loop-11…14`: the banyan. `loop-15`: the crowd. Each sheet's caption says what changed.
- `trellis.jpg`: the codex refs (one object on white), the raw TRELLIS generations, and what survived the decimation.
- `codex-reachable.jpg`: the final lab frame | a codex `image_gen` EDIT of that same frame into Jiehua Neon, with the
  geometry kept. The props come back almost unchanged, so their geometry is at target level. What codex adds is surface
  and light: silk grain, antique brass, leaf texture in the canopy, warm lantern light, wet-stone streaks.
- `depth-slices-ab.jpg`: depth slices (left) vs the clean room's `renderer.clearDepth()` (right). With the clear, every
  world silhouette is gone.

## Cost (1206×2622, iPhone portrait at 3×, M5 Max Metal, `bench(60)`, median of 3)

| Item | Tris | Draws | Note |
|---|---|---|---|
| Viewmodel (jian + TRELLIS guard + tassel + talisman + gauntlet + claw + forearms) | 13.5 k (guard 3.0 k) | 14 | 7 rigid groups × (body + ink hull). Merging the rigid groups gives 10. |
| Paifang | 14.0 k | 1 (+ signs) | — |
| Lanterns + strings (lab-merged; the clean room instances them) | 20.0 k | 1 | — |
| Banyan v4 | 42.1 k | 1 | The canopy is ~90 % of it. **Phone lever**: `lat 4 lon 7` lumps, or 6 lumps per shelf. |
| TRELLIS crowd + 3 tables | 69.4 k | 5 | Walkers are 1.36 k each × 36. **Phone lever**: a 400-tri LOD past 25 m (`driftwood_post.py --tris 400`). |
| Whole lab frame | 251 k | 45 | **2.3 ms/frame** (2.1 without the viewmodel: within noise on the M5). |

- The viewmodel program costs ~25 ALU: 3 bands, 1 pow, 1 weave fetch, plus a decal fetch on the blade flats and the
  talisman only.
- The hull is one vertex push per vertex and a flat fragment.
- The phone risk is triangles (banyan, crowd), not pixels.

**GLB sizes (meshopt + quantised):**

| File | Size |
|---|---|
| `guard.glb` | 100 KB |
| `sitter.glb` | 47 KB |
| `walker.glb` | 39 KB |
| `banyan-trunk.glb` | 181 KB (hybrid toggle only; delete it if the hybrid is dropped) |
| Total | 366 KB |

**Time on the shared model lock:**

- Codex refs: 5 in parallel, ~1 min.
- TRELLIS.2 `1024_cascade`, one batch of 5: 20.6 min, under the 30-minute cap.
  - Load 71 s.
  - Guard 226 s, sitter 153 s, walker 77 s, banyan 536 s, gauntlet 176 s.
- `driftwood_post.py`: 10–40 s per prop.

## Learnings

1. **Toon metal needs restraint.** Loop 1 reflected a whole painted studio ("a matcap in code"), and brass and lacquer
   blew out to white. What reads like the target: 3 antialiased bands of a fixed view-space key light (upper left), ONE
   narrow specular band (`pow(R·H, 24)` → `band 0.35 / 0.8`), and a lit rim on the upper side. Keep the brass wash
   muted: `#9c7c3a` reads antique, `#b8913f` reads plastic.
2. **Placement is half of "not a toy".**
   - Build the frames explicitly: +y down the blade, +z (the flat) toward the eye, then a small roll (0.12). The old
     `setFromUnitVectors` + roll left the flat edge-on.
   - Lay the forearm in the screen plane (`elbowDepth ≈ 1`), from the bottom-left corner at ~33°. Then the cloth, the
     red cord, the bands and the talons all read.
   - Hang the tassel and the talisman from pivots IN FRONT of the grip (z +0.03), the tassel on the lower-left side and
     the talisman on the right. At z ≈ 0 they vanish behind the glove.
3. **The dragon head goes in profile**: its crown up the blade (+y), its snout out of the lower edge (−x), its flank to
   the eye. Facing up the blade (the weapon sheet's pose) it reads as a gold lump. Clip the TRELLIS socket ring (the
   back 20 % of its length).
4. **TRELLIS is right for one organic mass and wrong for thin parts.**
   - It excels at a sculpted head, a seated man or a walker with an umbrella.
   - Leaves, talons, straps and tassels come back as small loose parts, which the decimation and the crumb filter
     (`--min-part`) kill. Keeping them (`--min-part 0.00005`) gives flakes.
   - So make hybrids: TRELLIS for the mass, procedural for anything thin.
5. **TRELLIS colours come back dark and muddy.**
   - Snapping to the nearest palette colour turns everything black.
   - What works (`glb.ts`, `ramp` + `hues`): neutrals take the step of their luminance *relative to the model's
     brightest*; saturated vertices take a hue class (skin, red, blue, green).
   - For metal, the luminance modulates one wash, so the engraving survives as darker brass.
   - Two ramps (dark coats, beige jackets) give the crowd variety at one instanced draw each.
6. **Silhouettes and decimated meshes.** The depth silhouette inks every fold of a mesh with many small facets, and a
   decimated TRELLIS trunk turns to scribbles. Smooth normals (averaged per position) fix the shading, not the
   silhouettes. Keep TRELLIS props at mid distance, or give them simple surfaces (people are fine; bark isn't).
7. **Foliage, three tries:**
   - one big lumpy blob = a low-poly bush (v1);
   - loose small pads = lily pads (v2);
   - **cloud-shelves on every limb and twig tip** (7–9 flattened lumps, light greens on top, dark underneath, K.leaf
     pattern) = a painted banyan (v3/v4).
   - The codex edit shows the remaining gap is leaf texture and a leafy edge. The next try is a fringe of small leaf
     cut-outs on the shelf rims, high up where the no-cut-outs rule doesn't bite.
8. **Depth slices, not a depth clear.** The clean room's `post.ts` does `r.clearDepth(); r.render(vmScene, vmCamera)`.
   The composite's silhouette pass then reads a depth buffer that holds only the viewmodel, so **no world silhouette is
   ever drawn** (`depth-slices-ab.jpg`). The TRELLIS people and the banyan get ALL their ink from that pass. The fix is
   below (Integration, step 1): world in `[0.3, 1]`, viewmodel in `[0, 0.3)`, `ld()` undoing the slice
   (`src/core/worldDepth.ts`, E142). The viewmodel's own ink is the hull, so it doesn't depend on the pass.
9. **The ink hull** (`inkHullMaterial`) is a back-face shell pushed out a constant pixel width along an
   averaged-per-position normal. Living classes (matte, silk) vary the width 0.45–1.7× along the stroke (a dry brush);
   built classes stay ruled. The glow band gets none. With the sutra flip the hull turns gold for free.

## Integration into `src/dev/nine-dragon/` (the lead's files)

1. **`post.ts`: depth slices.** Add `uniform float uSlice, uVmNear, uVmFar;`, then replace `ld()` with:

   ```glsl
   float ldw(float z, float n, float f) { return 2.0 * n * f / (f + n - (2.0 * z - 1.0) * (f - n)); }
   float ld(float z) {
     return z < uSlice ? ldw(z / uSlice, uVmNear, uVmFar) : ldw((z - uSlice) / (1.0 - uSlice), uNear, uFar);
   }
   ```

   In `render()`, replace `r.render(scene, camera); r.clearDepth(); r.render(vmScene, vmCamera);` with:

   ```ts
   gl.depthRange(0.3, 1); r.render(scene, camera);
   gl.depthRange(0, 0.3); r.render(vmScene, vmCamera);
   gl.depthRange(0, 1);
   ```

   Also set `uVmNear` / `uVmFar` from the vm camera. The copy is in `src/dev/nd-lab/hero/base/post.ts`.
2. **Copy the modules**: `kitx.ts`, `vm-material.ts`, `weapon-parts.ts`, `viewmodel.ts`, `glb.ts`, `paifang.ts`,
   `banyan.ts`, `figures.ts`. Put them in `src/dev/nine-dragon/` (or a `hero/` subfolder) and change `./base/kit` →
   `./kit`, `./base/signs` → `./signs`, `./base/util` → `./util`. Move the four GLBs to `public/assets/nine-dragon/`.
3. **`weapon.ts` → `viewmodel.ts`.** The API is the same (`scene`, `camera`, `materials`, `layout`, `update(dt,
   VmState)`, `muzzleNdc`).
   - The constructor is now `new Viewmodel(shared.u.uSilk.value)`.
   - Load the TRELLIS head once: copy `loadGuard` from `main.ts`, i.e.
     `vm.setGuard(await loadGlb(url, { kind: 20, wash: 0xba9444, lumLo: 0.2, lumHi: 1.35, ao: 0.9, clipBack: 0.2,
     matrix: guardMatrix(box, 0.135, -0.004, 0.006, 0) }))`.
   - In `resize()`: `vm.u.uRes.value.set(bw, bh)`, `vm.u.uLinePx.value = max(1, 1.6·pr/2)`,
     `vm.u.uHullPx.value = max(1, 2.4·pr/2)`.
   - In `style()`: `vm.u.uSutra.value = s`.
   - Drop the per-frame `uLightDir` loop over `vm.materials`: the key light is fixed in view space.
   - The flying claw becomes `const cx = new KitX(); buildClaw(cx, 1); new Mesh(cx.build(), mat)`. VM kinds (20+) fall
     through the Jiehua program as plain washes.
4. **`square.ts`.**
   - Give `Ctx` a `kitx(name)` map beside `kit(name)`, and build each region as `merge([kit.build(), kitx.build()])`.
   - `paifang()`:
     `buildPaifang(k, x, ctx.signs, (px, py, pz, s) => ctx.lantern(px, py, pz, s), { x: GATE.x, y: Y0, z: GATE.z,
     posts: GATE.posts, s: GATE.s, plaque: '九龍', couplets: ['萬家燈火', '天下一家'], neonEaves: null })`. Pass
     `NEON.red` for round-4 A's glowing eaves. `curvedRoof` can replace `hipRoof` on the shrine and the stall too.
   - `banyan()`: `buildBanyan(k, x, { x: BANYAN.x, y: Y0, z: BANYAN.z, r: BANYAN.r, seed: 7, height: 11, spread: 7 })`.
     Keep your earth-god shrine and pillar banner after it.
   - Mahjong: `mahjong(k, x, rng, …, players 0, stoolWash, false)` for the tables. Then one `InstancedMesh` of
     `sitter.glb` per tone at `mahjongSeats(x, z, r)`.
   - The crowd: two `InstancedMesh` of `walker.glb` (DARK / LIGHT ramps, 7 : 3), replacing the procedural `person()`
     crowd. The ramps and hue classes are in `main.ts` (`DARK`, `LIGHT`, `HUES`).
5. **Phone budget.** Before the bench, drop the banyan's lumps to `lat 4 lon 7`, and give the walkers a 400-tri LOD
   past 25 m.

## Not done / next

- A leaf-card fringe on the banyan shelves (Learning 7).
- The 飞白 slash ribbon: the base would be Driftwood's sword ribbon plus a dry-brush strip.
- The hook pose's raised arm: `update()`'s aim slerp works, but comp-B's arm is higher and more side-on.
- Rigging the TRELLIS people with the rig bake (the brief's note).
