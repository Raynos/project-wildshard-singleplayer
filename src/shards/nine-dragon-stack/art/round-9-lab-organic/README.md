# Round 9 · lab P7 "organic": the banyan canopy, the TRELLIS props, the 千里江山图 sky screens (E169)

The brief: the organic and painted-sky detail the clean room still lacks.
1. The banyan's canopy reads as smooth blobs; the targets show a dense, layered, painted leaf mass with light breaking
   through and hanging aerial roots. It must hold up in a 360° walk-around (no flat cut-outs near the player).
2. Organic props from the local TRELLIS.2: guardian lions, the noodle stall, mahjong sets, potted plants, lanterns.
3. The LED sky screens: a real blue-green shanshui scroll, panning, at a visible pixel pitch, bloom on bright pixels.

- Page: `dev/nd-lab-organic.html`. Code: `src/dev/nd-lab/organic/`. Assets: `public/assets/nine-dragon/lab/organic/`
  (2.1 MB: `scroll.webp` 849 KB, `leaf-atlas.webp` 337 KB, `lion.glb` 233 KB, `stall.glb` 213 KB, `pots.glb` 193 KB,
  `mahjong.glb` 156 KB, `canopy.glb` 85 KB (variant 4 only: delete it if 4 is dropped), `lanterns.glb` 81 KB).
- The page renders the WHOLE clean room through `src/dev/nd-lab/organic/base/`: a snapshot copy of
  `src/dev/nine-dragon/` (2026-09-25 ~22:15) with three lab-wiring edits in `base/square.ts` (the banyan comes from
  `../banyan.ts` and its plan is exported; the stall's counter + pots go into their own kit `stall-counter`; the
  mahjong tables into their own kit `mahjong`). Don't integrate `base/`.
- Driven headless through `window.__ndOrg` = the clean room's `__nd` API plus `set(key, value)` and
  `cam(x, y, z, yawDeg, pitchDeg, hfov)` (no URL switches). Switches (`set` returns what it did):
  - `canopy` 0 lumps (the clean room) · **1 cards (default)** · 2 real leaves · 3 displaced shells · 4 TRELLIS clump;
    `solo` 1 hides all but the banyan, the plaza and the sky (the 360° test); `plate` 0/1 the silhouette plateau;
    `washBand`, `washInner`, `washTone`, `washPaint`, `leafInk`, `rim` (the foliage wash).
  - `props` 0/1 all TRELLIS props (1 hides the procedural stall counter they replace); `prop-<name>` one of them.
  - `sky` 0 procedural / **1 scroll**; `pitch`, `span`, `near`, `panSpeed`, `ledFill`, `ledGap`, `ledScan`,
    `ledBloom`, `skyGain`, `skySat`, `skyThresh`, `skyFog`, `module`, `moduleInk`.

## What won

| Piece | Won | Why |
|---|---|---|
| Banyan canopy | **painted leaf-cluster cards** (`canopy.ts` `cardGeometry` + `foliageMaterial('cards' / 'cards-depth')`) over a darker core (`shellGeometry(CORE)`) | Reads as a gongbi leaf mass from every side (`orbit.jpg`: 8 views, no card ever reads flat); 18 k tris × 2 passes + a 39 k core. Real leaves need 685 k tris for the same cover; shells stay blobs. |
| Aerial roots, ribbons, trunk | **procedural** (`banyan.ts` `curtainRoots` + strands + ribbons) | 240 wavy roots hung from the real limb sections (60 % reach the soil), 5 braided pillar roots, 44 strangler strands fused down the trunk, 90 wish ribbons. |
| Sky screens | **the codex scroll on an LED program** (`scroll.ts`) | A real 千里江山图 (3 codex panels, seamless), 0.06 m dots, 1.2 m module grid, 8 m steel frame, slow pan, rolling refresh band, bloom on the clouds. |
| Guardian lions | **TRELLIS** (`lion.glb`, 8.0 k tris) | Reads as a carved weathered-granite 石狮 on the balustrade posts. |
| Mahjong | **TRELLIS set as EMPTY tables**, the played tables stay procedural | The set brings 4 stools; under the TRELLIS sitters (who bring their own) every stool doubles. |
| Potted plants | **TRELLIS** (`pots.glb`, 7.9 k tris) | Boxwood balls, a cloud-pruned pine, jade, azalea in celadon / cobalt pots, at the shrine, the gate, the stall. |
| Lantern clusters | TRELLIS (`lanterns.glb`, 3.5 k) as accents only | The procedural ribbed lanterns glow better; the TRELLIS trio (red paper → emit 4.0) is fine under the awning and in the banyan. |
| Noodle-stall counter | **TRELLIS** (`stall.glb`, 7.7 k tris, two side by side) replacing the procedural box + cylinders | Stock pots, a wok, bowl stacks, jars on a steel-topped wood cabinet (steel ramp + wood hue class); the clean room's counter read as one plank. |

## The images

- `final.jpg`: target | clean room today | this lab, full frames and matched crops (canopy, sky, lion, stall).
- `loop-01…08.jpg`: the loops (capture | target / codex edit, a caption each on what changed and why).
- `orbit.jpg`: the 360° test, `solo` on, 8 views at 45°, 14 m out, cards (top) vs the clean room's lumps (bottom).
- `variants.jpg`: the five canopies on one camera (lumps, cards, leaves, shells, the TRELLIS clump).
- `sky.jpg`: the joined scroll, and the screen at the spawn: clean room | lab | target.
- `trellis.jpg`: the codex refs (one object on white), the raw TRELLIS generations, what survived the post.
- `codex-edits.jpg`: my frames | codex EDITS of them (the reachable targets of loops 5–8).

## Cost (1206×2622, iPhone portrait at 3×, M5 Max Metal, `bench(40)`, median of 3, the GPU otherwise idle)

The whole clean room is in these frames (1.19 M tris, ~95 draws before this lab). The M5 Max is not the phone: read
the deltas, not the totals.

| Camera | Clean room (all switches off) | Lab | Δ |
|---|---|---|---|
| hero cam (the banyan at 22 m) | 5.96 ms · 97 draws · 1.19 M tris | 6.42 ms · 103 draws · 1.40 M tris | +0.46 ms, +6 draws, +209 k tris |
| under the canopy (it fills the frame) | 5.86 ms · 97 · 1.19 M | 5.69 ms · 99 · 1.24 M | within noise: the fill is cheap |
| loop-5 (up at the screen) | 4.82 ms · 98 · 1.19 M | 5.32 ms · 104 · 1.38 M | +0.50 ms (the scroll's textureLod ×3 + props) |
| loop-1 (the spawn) | 8.25 ms · 94 · 1.19 M | 8.52 ms · 100 · 1.40 M | +0.27 ms |
| loop-2 (the Well, lions) | 3.85 ms · 75 · 0.98 M | 3.69 ms · 77 · 1.10 M | within noise |

The canopy alone, hero cam (`set('canopy', n)`, props and sky on):

| Canopy | Tris (canopy) | Draws | ms |
|---|---|---|---|
| 0 lumps (the clean room) | 28 k | 1 (in the banyan kit) | 5.96 |
| **1 cards** | 18.3 k × 2 passes + 39.4 k core | 3 | 6.10 |
| 2 real leaves | 685 k + 39.4 k core | 2 | 6.66 |
| 3 displaced shells | 210 k | 1 | 6.17 |
| 4 TRELLIS clump × 56 tips | 167 k (2 980 each) | 1 | 6.36 |

Props (one InstancedMesh each, the Jiehua program): lion 9 × 8.0 k = 72 k, pots 6 × 7.9 k = 47 k, stall 2 × 7.7 k =
15 k, mahjong 2 × 6.0 k = 12 k, lanterns 4 × 3.5 k = 14 k: **160 k tris, 5 draws**. Roots / strands / ribbons add
~40 k tris to the banyan kit (no draw). Whole lab frame: ≤ 1.40 M tris, ≤ 104 draws — inside Jake's 2.5 M / 200.
The phone risk is the a2c cards' fill in the close view (see Learning 8), then the lions' triangles.

## Learnings

### Canopy
1. **Cards win, if the card is part of a volume.** A card lit by its own plane is a cut-out; a card lit by its LUMP's
   ellipsoid normal (`lumpNormal`, per vertex) is a leaf of a round clump: the flat-wash bands run across all its
   cards, the lit top and the dark belly read as one mass. Cards sit on the lump surface (lift 0.6–1.0 × radius),
   lean 0.55 off its tangent, fewer on the underside (bias 0.35), stem end down. `CARDS = { perM2: 3.6, size: 1.5 }`
   gives ~20 cards a lump, 9.1 k cards, 18.3 k tris. Bigger cards = bigger painted leaves: 0.95 m read as moss.
2. **Alpha-to-coverage and the silhouette's alpha collide.** The clean room writes `alpha = near / viewZ` for the
   post's ink; a2c turns the output alpha into the sample mask AND writes it. Fix: two passes of the same geometry.
   - `cards`: a2c on, blend `rgb = src·1 + dst·0`, `a = src·0 + dst·1` (the colour lands, the target's alpha stays);
   - `cards-depth` (renderOrder 2): depth-EQUAL, depth-write off, blend `rgb = dst`, `a = src`: writes the inverse
     depth on exactly the samples the cards covered. `invariant gl_Position` in the shared vertex shader.
   The alpha is sharpened to a crisp edge at any mip (`(a − 0.5) / fwidth(a) + 0.5`) with the mip level's coverage
   loss added back (`a · (1 + 0.25 · mip)`), so far clusters don't thin out.
3. **The silhouette plateau.** With true depth the post inks every card edge and every pin-hole to the background
   (black blotches, `loop-02`/`loop-03`). Every foliage fragment writes its LUMP's front depth instead
   (`aLump` = centre + radius, `vPlate = viewZ(centre) − 0.85 r`): the ink draws each clump's outline and the step
   to the clump behind it (the gongbi way), never a hole. `set('plate', 0)` shows the blotches.
4. **Real leaves** (`leafGeometry`: 7-vertex fans, the outline from a rim-distance attribute) are opaque and
   HSR-friendly and hold up perfectly in orbit, but the same cover costs **685 k tris** (45 leaves / m², 0.16–0.26 m)
   and still reads darker and busier. Not phone-feasible at that density; sparse, they read as a fringe on blobs.
5. **Displaced shells** (`SHELLS`: lat 12 × lon 20, 11 round bumps, the Voronoi leaf pattern): 210 k tris, opaque,
   scalloped, but still cloud-shelf blobs, like the clean room's lumps. The cheap fallback if a2c is refused.
6. **TRELLIS canopy clump**: the canopy ref ("one dense clump of banyan foliage", 584 s, 16.2 M faces) came back as a
   whole little tree. Decimated plainly (fqmr 1.2 k) it is leaf flakes (the hero lab's finding); voxel-remeshed first
   (`--remesh 0.02`, 3 k tris) it is a solid faceted leafy mass. Instanced once per limb tip (56 × 2.6 m, `canopy` 4)
   it reads as a dense dark crown with the K.leaf pattern and holds up in orbit: the best OPAQUE option (167 k tris,
   HSR-friendly, no a2c). It loses to the cards on the painted leaf (no gongbi leaves, faceted edges) — keep it as the
   fallback if a2c costs too much on the phone.
7. **Colour**: `LEAF_PALETTE = [#131d19, #20322a, #31483c, #566a4d, #a4a674]` (sampled toward the codex edit of my own
   frame; the style-A crown k-means is #232c22…#727d6b after its grade), a flat lit band (0.32) so the crown doesn't
   go khaki from above, the painted atlas' own light / dark leaves at full weight (1.0), the atlas' ink under
   luminance 0.07–0.2 as the leaf outlines.
8. **The iPhone.** a2c is not free on a tile-based GPU: like `discard` it makes the fragment decide visibility, so
   hidden-surface removal can't cull under the cards. Keep them AFTER the opaque world (renderOrder 1/2) so every
   opaque occluder is resolved first, keep them to the crown (9 k cards, ~2–4 layers deep), and run the 9-band fog
   per VERTEX (`vFog`): the fragment program is one texture fetch, a ramp and a mix.
9. **The limb path's first ~70 % is its root climbing the trunk** (`buildBanyan` sweeps foot → spiral → limb →
   tip): roots and ribbons hung at t < 0.7 hide against the trunk. Hang them at t 0.7–0.97.
10. **Spill turns roots red at distance.** 220 ribbons + lantern spill on the root curtain read as a red blob across
    the Well (`loop-08`); 90 ribbons in darker cinnabar `#9c2c1e`, roots `#3a3029` / `#4d4034`.

### Sky screens
11. **The painting**: three codex `image_gen` panels in the 千里江山图 style (azurite crests, malachite bodies, ochre
    feet, scalloped clouds; "both side edges soft mist"), joined by image quilting: a dynamic-programming
    minimum-error vertical cut through a 420 px overlap per join (the wrap too), a 22 px feather.
    3348 × 1024 WebP, 850 KB (scratch `panorama2.py`). A plain cross-fade + painted mist bank read as fog pillars.
12. **Seen from below a ceiling, "up" in the eye is TOWARD the viewer.** The painting's sky goes at the screen's
    near (south) edge and its water runs away north; then the peaks point up from every camera on the square.
13. **Pitch.** 0.2 m dots make the painting blocky (`loop-04`, the round-8 complaint). The targets' "visible pixels"
    are LED MODULES: dots at **0.06 m** (fading to their average under ~2.5–5 px), a **1.2 m** module seam grid
    (darkness 0.35), the **8 m** steel frame. Each dot shows one colour: the scroll is sampled at the dot's centre
    with `textureLod` at the dot's footprint.
14. **Framing.** From the square only the nearest ~25 m of the screen show between the decks, so: 32 m of screen per
    painting height, the painting's 0.74 at the near edge (lower hills → peaks → clouds in view), its sky / water
    rows' averages past its edges. Pan 0.35 m/s (the scroll loops in ~5 min). Screen 2 starts 97 m further along.
15. **Bloom**: the clouds (luminance > 0.62) are pushed ×1.9 past the post's bloom threshold (1.0): a soft LED glow;
    brightness 1.15, saturation 1.1, a slight cool diode cast, a rolling refresh band (0.08), fog scale 0.22.

### TRELLIS props
16. **TRELLIS.2 (1024_cascade, codex refs "one object on white, chunky solid forms, no thin loose parts") →
    `driftwood_post.py` → meshopt.** Per prop (gen s / raw faces → post):
    - lion 376 s / 18.7 M → **8.0 k** with `--simplifier blender` (the collapse). `--remesh 0.006` / `0.015` and fqmr
      shattered it into flakes: a remesh at a few mm makes a huge mesh the budget can't hold.
    - lanterns 154 s / 11.0 M → **3.5 k** with `--remesh 0.008` (fqmr stalled at 16.6 k on the open shells). The thin
      wooden bar drops out, the three lanterns survive as faceted balls.
    - mahjong 182 s / 8.9 M → **6.0 k** with the collapse: table, felt, tile walls, four stools all survive.
    - pots **945 s** / 37.1 M → **7.9 k** with fqmr (the collapse stalled at 24 k and ate the pots; `--remesh 0.012`
      lost the big boxwood ball). Dense foliage is the slow case: one foliage prop per batch.
    - stall 379 s / 17.2 M → **7.7 k** with the collapse (pots, wok, bowls, jars, cabinet doors).
    - The batch of six overran the 30-minute cap (the pots alone took 16 min): I stopped it at 34 min when another job
      queued and re-ran the stall (+ the canopy clump) as a second, short batch.
17. **Colour**: `loadGlb` ramp mode (the clean room's `glb.ts`): the lion on a 6-step wet-granite ramp (#2f2f33 …
    #94949a, no hue classes); stall / mahjong / lanterns on a wood ramp + hue classes (red → cinnabar, green → felt,
    skin → ivory tiles / brass); pots on a steel-grey ramp + cobalt / celadon / leaf green / azalea red. Lanterns:
    `glowRed` sets `aMisc.x` (emit) on the red vertices.
18. **Placement**: lions on every third balustrade post (over the lotus cap) + both ends of the street balustrade,
    facing the plaza; pots at the shrine, both gate flanks, the stall's corner and the east edge; lantern trios under
    the awning and in the banyan; mahjong sets at (19.6, −11.0) and (11.6, −3.2), empty.

## Integration into `src/dev/nine-dragon/` (the lead's files)

1. **Copy** `canopy.ts`, `scroll.ts`, `props3d.ts` into `src/dev/nine-dragon/` (imports: `./base/style` → `./style`,
   `./base/util` → `./util`, `./base/kit` → `./kit`, `./base/layout` → `./layout`, `./base/hero/glb` → `./hero/glb`).
   Replace `hero/banyan.ts` with `banyan.ts` (imports `./base/…` → `../…`, `./canopy` → `../canopy`).
   Move the assets to `public/assets/nine-dragon/` (`leaf-atlas.webp`, `scroll.webp`, `lion.glb`, `pots.glb`,
   `mahjong.glb`, `lanterns.glb`, `stall.glb`) and fix the two URL constants (`ASSETS` in `props3d.ts`, `setup.ts`).
2. **`square.ts` `banyan()`**:
   `const plan = buildBanyan(k, kx, { x, y, z, r, seed: 7, height: 11, spread: 7 }, null);` (`null` = no K.leaf
   lumps) and hand `plan` to main (a `Ctx` field `banyan: BanyanPlan | null`, or the lab's module export). `noodleStall()`: drop the counter box, its steel top and the four pot cylinders (keep the steam
   points) — the TRELLIS counter replaces them.
3. **`main.ts`, after `bakeSpill(kitGeos, emitters)`** (the lab's `setup.ts` §1 without the variants):

   ```ts
   const atlas = await loadAtlas('/assets/nine-dragon/leaf-atlas.webp');
   const fu = foliageUniforms();
   const rng = new Rng(97);
   const gCards = cardGeometry(plan.lumps, rng, CARDS), gCore = shellGeometry(plan.lumps, rng, CORE);
   bakeSpill([gCards, gCore], emitters);
   const cards = new Mesh(gCards, foliageMaterial(shared, 'cards', fu, atlas));
   const cardsDepth = new Mesh(gCards, foliageMaterial(shared, 'cards-depth', fu, atlas));
   cards.renderOrder = 1; cardsDepth.renderOrder = 2;
   scene.add(cards, cardsDepth, new Mesh(gCore, foliageMaterial(shared, 'inner', fu, null)));
   ```

   `loadAtlas` is in `setup.ts` (copy it: mips, anisotropy 4). The lab built the leaves and shells from the same
   `Rng(97)` AFTER these two, so the cards and the core come out identical. The TRELLIS-clump fallback is
   `trellisClump(plan.tips, mat)` in `setup.ts`.
4. **Sky**: `const scroll = await loadScroll('/assets/nine-dragon/scroll.webp');` then
   `screen.material = scrollMaterial(shared, scroll, 58, 80, SCROLL).mat` and
   `screen2.material = scrollMaterial(shared, scroll, 70, 64, { ...SCROLL, offset: 97 }).mat` (same planes,
   `rotation.x = π/2`). `screenMaterial` can go.
5. **Props**: `for (const p of await loadProps(mat)) scene.add(p.mesh);` (the Jiehua `mat`; one InstancedMesh a prop).
6. **Post**: nothing. The a2c needs the MSAA ×4 scene target it already has; the plateau goes through the alpha the
   silhouette already reads.
7. **Phone levers** (if the bench on the phone asks): the core at `lat 4, lon 7` (−15 k tris); cards `perM2 3` (−3 k);
   a 3 k lion LOD past 25 m (`driftwood_post.py --tris 3000 --simplifier blender`); the leaf atlas at 512².

## Not done / next

- The trunk: the targets' trunk is a fused bundle of vertical root strands with ink fluting; the hero trunk + my 44
  strands get part of the way. A TRELLIS trunk hybrid (the hero lab's `banyan-trunk.glb`) with the strands on top is
  the next try.
- Leaf wind: the cards could sway per lump (a vertex offset by `aLump`) — nothing moves yet.
- The lion's pose varies by nothing: mirror every other one (scale x −1) for a pair (a male with the ball, a female
  with the cub needs a second ref).
- The stall's cooks and the steam are the clean room's; the TRELLIS counter's pots sit ~0.3 m from the clean room's
  steam points (`ctx.steam`), move them onto the pots.
- Bench on the phone: the a2c cards and the 9 lions are the first levers (README Integration 7).

