# Round 7 · lab P3 "facade": the Kowloon density kit + grammar (E169, 2026-09-25)

The subset: **density**, the #1 gap between the clean room and the mockups. The mockups' tower walls are fully covered
(balconies, window cages, AC units, laundry, pipes, cables, awnings, plants, sign boxes, water tanks, rooftop shacks
under glazed roofs, lit rooms, setbacks, stacked add-ons). This lab builds a **facade kit + a deterministic grammar**
that dresses a plain box (3 m floors, ~4 m bays) into that. A whole street canyon costs ~30 draws, however many towers
it has.

- Page: `dev/nd-lab-facade.html`. Code: `src/dev/nd-lab/facade/` (three.js only).
- Captures: `capture.mjs` in this folder, driven through `window.__ndFacade` (no URL switches).
- Scenes: a **street canyon** of 10 dressed towers along a 12 m street, closed at the far end by 2 painted towers and 2
  walls built with `dressWall`. A **Well shaft** of 4 towers round a 24 × 30 m void, from 60 m below the street to
  60 m above it.

## What won

| | |
|---|---|
| **API** | `dressTower(box, seed, options, dressing)` and `dressWall(dressing, p0, n, length, y0, y1, seed, options)`, the drop-in for the clean room's plane walls. Then `spanStreet(dressing, a, b, seed)` for what is strung across a street or the Well, and `buildFacade(dressing, uniforms)` → `{ group, stats }` |
| **Batching** | One `Dressing` for every tower gives **one InstancedMesh per kit piece** (28 pieces), **one InstancedMesh for all the windows** and **one merged shell mesh** |
| **Windows** | Interior mapping on ONE instanced quad per window: a fake 16 cm reveal, glass with 4 mullion styles, 4 frame colours, a curtain, a room box with a partition or wardrobe, a scroll and a fluorescent tube. All of it is ruled in ink, lit (warm or cool) or dark. Under ~12 px a window collapses to its average colour, so nothing aliases |
| **Shell** | One quad per bay-floor cell. Per vertex it bakes the patchwork wash, the **AO under every projection** (an ink-wash gradient) and the neon spill around sign boxes. The drip stain under a high AC unit is packed into `aPat`. Finishes run in vertical strips: render, mosaic tile or boarded panels. There are no decals and no transparency |
| **Bars** | Railings and grilles are **real flat bars**: two back-to-back quads, 4 tris each, ruled on their long edges. No cut-out cards (Jake's rule) and no `discard` (iPhone hidden-surface removal) |

**Final numbers.** Headless Chromium on Metal on this Mac, 1206 × 2622 (402 × 874 @3×). Each figure is the GPU-synced
median of 3 × 40 frames, with the full frame included: MSAA ×4 HDR, the depth silhouette, the half-res bloom and the
composite.

| Scene | Draws, facade (whole frame) | Triangles | Instances | Windows | ms / frame |
|---|---|---|---|---|---|
| Canyon (10 dressed + 4 far towers) | 30 (39) | 518 k (shell 57 k) | 7 557 | 5 340 | **1.8–2.0** |
| Well (4 towers × 120 m) | 27 (33) | 297 k | 5 194 | 2 866 | **1.6–1.7** |

- Build time is 55–65 ms of JS for both sets.
- The phone has not been measured. At the ~8–10× desktop-to-iPhone ratio that is ~15–20 ms: 30 fps, with little room
  to spare.

Where the canyon's triangles go (instances / triangles):

| Piece | Instances | Triangles |
|---|---|---|
| Single-window cage | 576 | 96 k |
| AC unit | 1 102 | 66 k |
| Balcony | 282 | 62 k |
| Wide cage | 231 | 48 k |
| Plant | 540 | 27 k |
| Ledge | 1 254 | 15 k |
| Lantern | 123 | 13 k |
| Eave | 444 | 12 k |
| Everything else | — | under 11 k each |

## The loop (capture | target crop, every image read)

| File | What changed | Gaps it showed |
|---|---|---|
| `loop-1.jpg` | Kit + grammar v1: cells, modules, add-ons, baked AO | Already denser than the clean room. But **992 k tris** (box bars) → **578 k** with flat bars. The laundry read as striped flags. The Well's fog band leaked into the street |
| `loop-2.jpg` | Windows 1.55 / 2.8 m + a 3-window ribbon, 1.62 m tall; glazed eave bands every 4–7 floors; timber verandas; thick pipe runs | Too much blank wall. The Well read as a modern courtyard |
| `loop-3.jpg` | Warm washes; 1.8–2.4 m verandas with red posts, eaves, lanterns and couplets; cheaper kit (403 k); `detailY` band | Blank planes. Nothing strung across the street. The Well's fog band sat too low |
| `loop-4.jpg` | Wall finishes (render / mosaic / boards) and string courses; `spanStreet` (cables, laundry, lantern strings); timber shop canopies | See the codex edits below |
| `loop-5.jpg`, `loop-6.jpg` | Tone toward the codex edits. **Found: the sky was ~40 levels brighter than the fog** (three sRGB-encodes a clear colour set with no target bound). Fixed; blue-hour silk | The canyon now sits with the codex edit |
| `loop-7.jpg` | Darker warm washes; lines dissolve by 120 m; irregular wash lines | The Well's spans cut across the camera |
| `loop-8.jpg` | Final: the Well re-framed like comp-B, a softer silk band, the far end built through `dressWall` | — |

- `final.jpg`: BEFORE (round 5) | LAB | TARGET, for the Well and for the street canyon, plus codex's edit of a lab frame.
- `codex-edit-{canyon,shaft,wall}.jpg`: my loop-3 frame | codex `image_gen` EDIT of it in Jiehua Neon (ART-STYLE-RESEARCH
  §6 prompt A first, "keep every piece of geometry"). codex kept **all** of my geometry and only changed the washes:
  warm grimy concrete, a blue-hour sky, darker values, furnished rooms, wet ground. So the geometry is now dense
  enough for the style, and the rest of the gap is surface tone. That is lab P1 "ink".
- `lab-{canyon,shaft,wall,spawn}.jpg`: the final frames, downscaled.

**Honest read.** At phone size the lab's Well walls and canyon read as the mockups' *kind* of wall. They have the same
vertical runs of cages, balconies and bay boxes, eave bands, lanterns, laundry, pipes and cables. A stranger would still
tell them apart:

1. **Tone.** The washes are cleaner and paler, with no grime, and the ground is not wet (P1).
2. **No hero neon signs** in the frame. The sign slots are emitted but the lab draws them as plain lit boxes.
3. **Near-camera hero pieces.** comp-C's timber shop veranda with people is authored work, not grammar.

## Learnings

1. **Density costs triangles, not draws.** Batch the whole city through one `Dressing`: draws scale with the number of
   piece types (~30), not with towers or instances. The triangle budget is set by the bars, since cages + balconies =
   40 % of the canyon. Box bars (12 tris) → flat bars (4 tris) and dropping the hidden junk took the canyon from
   992 k → 468 k at the same look.
2. **Interior mapping in one instanced quad** is the cheapest big win. It gives the facade parallax, warm rooms and
   curtains with zero window geometry, one draw for 5 k windows. A fake reveal in the same shader removes the need for
   frame geometry. The average-colour fallback under 12 px is essential: a room at 3 px is noise.
3. **The shadow wash under each projection is what makes the geometry read as depth.** Bake it into per-cell shell
   vertex colours (gallery 0.45, balcony 0.55, add-on 0.64, enclosed 0.70, bay 0.80, cage 0.86, eave band 0.66 at the
   cell's top edge). Transparent multiply decals did the same with overdraw, and were dropped.
4. **Openings, not walls.** The mockups' walls are ~60–70 % openings. 1.2 m windows in a 4 m bay read as blank
   concrete. What made the facades read full:
   - 1.55 / 2.8 m windows and a 3-window ribbon, 1.62 m tall;
   - vertical column programs, with 1 floor in 4 mutated;
   - add-on rooms hung off ~4.5 % of the bay-floors.
5. **What makes it Chinese, not generic HK:**
   - glazed pent-eave bands every 4–7 floors;
   - timber verandas (1.8–2.4 m deep, red posts, lanterns, couplets);
   - glazed hip roofs on the rooftop shacks.

   Without them it reads as any modern block.
6. **The sky/fog bug.** `renderer.setClearColor(c)` with no target bound is stored sRGB-encoded. Clearing a linear
   HDR target with it made the lab's sky ~40 levels brighter than its fog (#aab4c6 fog rendered as a (208, 212, 221)
   sky). Set the clear colour *after* binding the target (`post.ts`), or use a sky mesh as the clean room does.
7. **Fog band placement.** A silk band at the viewer's own height turns the whole Well into a white wall. Put it
   under the ledge (y −18, scale height 14 m, density 0.035) so the walls dissolve over ~40 m, as in comp-B.
8. **Things strung across a street must avoid the camera's volume.** A cable at 2 m reads as a black bar across the
   frame. Regular laundry reads as bunting: skip ~30 % and randomise the gaps.
9. Sibling labs all declared `window.__lab` with different types (TS2717, a tsc break). This lab uses `__ndFacade`.

**What failed and why:**

- Alpha-cut railing planes: Jake's no-cardboard rule, plus `discard` defeats hidden-surface removal.
- Multiply decals: overdraw.
- Box bars: 1 M tris.
- Fog band at the eye's height.
- Uniform-colour laundry and a regular garment rhythm.

## Exact parameters (grammar.ts)

- **Grid:** floor 3 m; bays = round(len / 4).
- **Column weights:** win2 .14, win1 .06, win3 .06, cage1 .13, cage2 .12, balcony .16, balconySolid .06, enclosed .12,
  bay .08, ac .05, blank .03. Per-floor mutation 0.26.
- **Add-ons:** 0.045 × bays × floors; 1–2 bays × 1–3 floors; 0.9–1.7 m deep; tin slats or glazed tile.
- **Eave bands:** every 4–7 floors (−2 × timber).
- **Pipes:** runs at 70 % of the bay seams; 1–4 pipes, ×1.0–2.3 thick.
- **Cables:** floors × 0.2 bundles per face.
- **Lighting:** lit share 0.5 (the Well 0.55); curtains 45 %; 14 % cool-lit rooms.
- **Detail:** `detailY` = [street, street + 40] for small clutter. Clutter shrinks into the wall at 55–85 m (vertex
  shader).
- **Timber:** 0.1 on streets, 0.75 in the Well.
- **Galleries:** 6 % of floors on streets, 40 % in the Well.
- **Material:** line fade 32–120 m; ink #14161c → #7a808c by 70 m; shade tint #a7b0c4; undersides × 0.5.
- **Fog:** silk #9eabc2 (the Well band #7d89a3); base fog 0.0085 / m.

## Integration into the clean room (`src/dev/nine-dragon/`, lead's files)

1. **Copy the modules.** Copy `rng.ts`, `geo.ts`, `pieces.ts`, `grammar.ts`, `batch.ts` and `material.ts` into
   `src/dev/nine-dragon/facade/`. The facade keeps its own program, one more than today: its attribute layout adds
   `aTan` so instances can be scaled non-uniformly, and its kinds differ from `kit.ts`.
2. **Unify the fog and light** (in `material.ts`).
   - Replace `COMMON_GLSL`'s `silkFog` with `style.ts`'s `FOG_GLSL` + `NOISE_GLSL`.
   - Build its uniforms from `shared.u`: `{ ...shared.u, uInk: shared.u.uInk0, uInkFar: shared.u.uInk1, uSky: { value: new Color(0xbcc4d2) } }`.
     `uCam`, `uLinePx`, `uLineFade`, `uLightDir`, `uShade` and `uSilk` already match by name.
   - Delete `sharedUniforms()`.
3. **towers.ts.** Make one `const fd = new Dressing()` at the top of `buildTowers`. Then:
   - Replace every `wallRun(ctx, rng, p0, n, length, y0, top, kit, opts)` with
     `dressWall(fd, p0, n, length, Y0, top, seed, { shops: true, street: Y0, detailY: [Y0, Y0 + 40], timber: 0.15 })`.
     The shops are the grammar's ground floor, so drop `shopfronts(…)` there.
   - Towers beyond ~95 m get `lod: 1`; beyond ~150 m, `lod: 2` (painted).
   - Replace the street's cable/laundry loop with `spanStreet(fd, a, b, seed)`.
4. **well.ts.** In `buildWell`, dress the Well's four walls into the same `fd`: `dressWall(fd, w.p0, w.n, w.len, STRATA[0], w.top, seed, { gallery: 0.4, timber: 0.75, lit: 0.55, setbacks: false, street: Y0 })`.
   - Split it per stratum band if you want the deep strata darker (pass `wash`).
   - Run `spanStreet` across the shaft *below* the ledges only.
5. **main.ts.** After `buildTowers` / `buildWell`, call `const { group } = buildFacade(fd, uniforms)` and `scene.add(group)`.
   - For the wet mirror, set layer 1 on the meshes named `facade-lantern`, `facade-signBox` and `facade-signFlat`.
   - Fill the sign slots with real calligraphy:
     `for (const s of fd.signs) ctx.signs.place({ at: s.at, normal: s.normal, size: s.size, spec: { text: rng.pick(SIGN_WORDS), color: hex(s.color), vertical: s.blade, style: 'tube' }, blade: s.blade }, bladesKit)`.
   - The old `ctx.put` / `dressing.ts` path can go for these walls.
6. **Budget at the spawn.** The canyon above is ~500 k tris.
   - If the spawn plus the Well plus the rest goes past ~1 M, first lower `detailY`, then set `lod: 1` on the upper
     segments.
   - The cages are the biggest line. A far variant with a painted-bar panel (kind `bars`, opaque, already in the
     material) for towers > 60 m would save ~40 %.
