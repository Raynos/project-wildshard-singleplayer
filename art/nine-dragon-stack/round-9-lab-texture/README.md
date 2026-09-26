# Round 9 · lab P5 "texture": painted surfaces under the Jiehua ink (E169, 2026-09-25)

The subset: make the stone, flagstones, concrete, tiles, lacquer and timber read **painted** — carved reliefs, grime
runs, water stains, dappled wet granite, glazed tiles, weathered lacquer, torn bills — while the ruled ink stays crisp
and the palette stays the wash's. Throwaway prototype; the lead copies the module into the clean room.

- Page: `dev/nd-lab-texture.html`. Code: `src/dev/nd-lab/texture/` (imports `three` only + its own folder). Driven through
  `window.__tex` (no URL switches): `cam(name)`, `cams()`, `paint([master, flags, walls, wood/lacquer/tiles])`,
  `paint2([2nd-scale, ink lean, posters, puddle/dapple])`, `tilePitch(x, y)`, `pixelRatio(r)`, `bench(n)`, `stats()`,
  `snapshot(w, h, q)`, `paintInfo()`.
- Test scene (`scene.ts`): a corner of Lantern Square at +125 m, blue hour — 78 m of wet flagstones, the Well's carved
  balustrade run, the facade lab's Kowloon grammar above a row of shopfronts (poster piers, timber frames, glazed-tile
  lean-tos, striped awnings), a cinnabar lacquer gate with an azurite roof, a lacquered lantern post, a dressed block to
  the north and kit towers across the Well. Neon: lightbox 麵, blade tubes 茶 / 藥房 / 旅館 / 牙科, lanterns, a lamp.
  8 cameras (corner, panel, down, shop, gate, roof, tower, far). 31–41 draws, 75–84 k tris.
- **Textures**: `public/assets/nine-dragon/lab/tex/` — 9 layers, 1024², JPEG q80 + 3 small alpha maps, **3.65 MB**.

## The files

| File | What |
|---|---|
| `final.jpg` | **The final side by side.** Row 1: lab frame \| codex edit of that frame \| round-8 target (corner, tower). Rows 2–3: surface crops, lab \| edit \| target (flagstones, balustrade panel, stone + flags, tower wall) |
| `loop-01.jpg` … `loop-14.jpg` | Each loop: top = lab crops (flags, panel, stone + flags, tower wall, shopfront, lacquer), bottom = the same round-8 target crops |
| `ab-1.jpg`, `ab-2.jpg` | Final A/B per camera: paint off (the round-8 flat washes) over paint on |
| `layers.jpg` | The 9 layers tiled 2 × 2 over their washes (seams / repeats check) |
| `sources.jpg` | The codex swatches: row 1 v1 (from crops of the round-8 targets), row 2 v2 "dab" (from codex edits of the lab's own frames) |
| `target-codex-{corner,tower,shop,panel}.jpg` | Codex `image_gen` EDITS of the final frames (surfaces repainted, geometry kept): the reachable target |
| `target-codex-{corner,down}-v1.jpg` | Codex edits of the loop-3 frames (what taught the dab technique) |
| `tools/` | `mkjobs.py` (swatch prompts), `mkedits.py` (frame-edit prompts), `texprep.py` + `spec.json` (swatch → layer; `spec-v1.json` = the v1 layer set), `tilesheet.py`, `capture.mjs` (Playwright, Metal, muted; `--ab`, `--bench`), `board.py` / `boards.py` (every board here), `texstats.py` (painted-detail ruler) |

## How it works

1. **Swatches from codex `image_gen`** (`tools/mkjobs.py` → `scripts/horizon-matte/run_codex.py`, ~1 min each, 6–8 in
   parallel). Style paragraph first, then the subject, then "flat, orthographic, evenly lit, edge to edge, tileable". v1
   took crops of the round-8 targets as style refs; **v2 took crops of codex edits of the lab's own frames** (the
   painter's own rendering of *this* scene's stone) and came back as dappled "cun"-stroke dabs — that set won.
2. **`texprep.py` turns a swatch into a layer**:
   - *heal*: offset by half + quilting min-cut (the patch is the best-matching interior chunk; both seams follow the
     minimum-error path, feathered 1.5 px), horizontally then vertically. Tiles instead crop exactly 7 × 7 measured
     periods (autocorrelation: 167 × 153 px) and cross-fade 80 px into the next period, so joints stay aligned.
   - *detail ratio*: linear texel ÷ its local mean (a wrap-around gaussian, `sigma` × size, mixed in by `flatten`), chroma
     kept at `chroma`, contrast × `contrast`, renormalised so every channel's mean is exactly 1, **stored linear as
     ratio / scale** (scale 2, tiles 3, flags / wood 2.5). The mip chain therefore converges on 1: a far surface is
     exactly its flat wash, so the round-8 palette fit survives and there is nothing to repeat at distance.
   - *alpha* (separate greyscale JPEG): flags = cavity (smoothed darkness → puddles), posters = coverage.
3. **One `DataArrayTexture`** (`paint.ts loadPaint`): 1024² × 9 RGBA8, rows flipped so the image top is v = 1 (grime runs
   fall toward the kit's −v), mipmapped, anisotropy 8, linear (NoColorSpace).
4. **The shader multiplies the wash by the ratio before the ink is composed** (`PAINT_GLSL`), so lines stay crisp:
   - flagstones (kind 3): each stone picks one of two granite layers, a random 2.4 m window and a quarter turn,
     sampled with `textureGrad` on the continuous world gradients (no mip seam at the joints); the ratio also
     drives wetness (dark dabs wet: the sky sheen gathers there, and a painted floor keeps a 14 % fresnel floor)
     and, in the streak cards, breaks the neon reflections on the dabs (`paintWetDapple`, one more sample);
   - stone (kind 9, `surf: stone`): 2 scales (1.7 m and × 0.383) + a slow noise swing of the strength; rain rivulets
     (`pRivulet`, thin sheen threads that fade before going sub-pixel) on wet vertical faces;
   - carved panel (kind 5): a balustrade-sized face (0.3–1.2 m tall, 1.8–8 × wide) takes the painted frieze over the
     whole face (its carved frame, lit lips and inked relief replace the ruled inset + procedural ruyi, which fade under
     it); a bigger stone box takes plain stone; an `accent` board takes weathered lacquer, `surf: wood` the planks;
   - concrete (kind 1 in style.ts and every concrete-ish surface of the facade program): 6 m tile with its slab seams
     kept on v, × the stone dabs at 2.3 m; world-anchored in the facade program so neither cells nor pieces show seams;
   - glazed tiles (kind 2, both programs): 7 × 7 tiles per layer; the rulings take the texture's pitch
     (`uTilePitch` 0.24 × 0.22 m) so the joints and the ink coincide;
   - lacquer / wood / posters by `Look.surf` (flag bits × 4096): `SURF = { none 1, stone 2, concrete 3, lacquer 4, wood 5,
     poster 6 }` (0 = by kind). Posters: the concrete, then torn bills in a ragged 0.35–2.5 m band, their paper × the
     wall's grime.
   - grime is an INK wash: what a ratio darkens leans toward `uPaintInk` (slate `#2c3a52`, `uPaintK2.y` 0.5), not brown.

## The loops (see `loop-NN.jpg`)

| # | Change | What it showed |
|---|---|---|
| 1 | v1 swatches, raw | It works and the lines stay crisp; but concrete reads as camouflage blotches, flag damp-patches too big |
| 2 | flatten the biggest blotches (sigma 5 %) | Distance clean, no repeats; close surfaces still photo-ish |
| 3 | wet stone darkening + sheen, bills take the wall grime | The balustrade was warm-pink: the lab's 7 shopfronts' spill (0.3 × 14 m away), not the paint |
| 4 | rain rivulets; lab shop spill 0.12 | Stone cooler; wet reads a little |
| 5 | brush-dab unsharp boost, slate ink lean, reflections break on the dabs | **Codex edits of loop-3 frames** show the painter wants dense dappled dabs, blue slate darks, fragmented reflections |
| 6 | **v2 dab swatches** (codex painted them from those edits); whole-face frieze | The step change: flags and stone now share the edit's technique |
| 7–10 | dapple strength / mean 1, flag blotch flatten, sky sheen in the wet dabs, a fresnel floor | Flags wetter and bluer; still darker than the edit (palette) |
| 11 | the facade grammar walls in the scene (the real clean-room walls) | Paint on the shell cells alone barely shows: the pieces cover the wall |
| 12–13 | paint every concrete-ish facade surface (modules, slabs, AC, slats, pipes) | The towers read as painted weathered concrete, like target-3 |
| 14 | concrete 1.1 × 0.9 (final) | |

**Painted-detail ruler** (`tools/texstats.py`, luma std of the 3 px high-pass = "fine", 3–12 px band = "mid", lab ÷ its
own codex edit; 1.0 = as much painted surface detail as the painter put there):

| Region | paint off | final (loop 14) |
|---|---|---|
| flagstones, fine / mid | 0.52 / 0.61 | **0.75 / 0.78** |
| balustrade panel, fine / mid | 0.45 / 0.44 | **0.64 / 0.79** |
| tower wall (mostly windows and pieces), fine / mid | 0.83 / 1.03 | 0.87 / 1.06 |

The codex edit of the *final* frame changes the surfaces far less than the edit of the loop-3 frame did (compare
`target-codex-corner-v1.jpg` with `target-codex-corner.jpg`): it now mainly darkens the sky, blues and brightens the wet
flags and adds reflections — palette and reflection, not surface.

## Cost

| | |
|---|---|
| Whole frame 1206 × 2622 (M5 Max, headless Chromium, Metal; 6 interleaved on/off runs × 20 frames, medians; a TRELLIS job shared the GPU) | corner 4.88 vs 4.85 ms, down 4.29 vs 4.19, shop 5.11 vs 5.03, far 4.75 vs 4.74 → **+0.00–0.10 ms** |
| Draw calls / triangles | **+0 / +0** (it is a sampler and ALU in existing programs) |
| Samples per fragment | flags 1 (+1 in a streak card), frieze / tiles / lacquer / wood 1, stone and concrete 2 (1 with `uPaintK2.x = 0`, the phone knob), poster walls 3 |
| Download | **3.65 MB** (9 × 1024² JPEG q80 + 3 alpha maps) |
| GPU memory | 50 MB as RGBA8 (lab). Shipping: the game's KTX2 bake (`scripts/bake-ktx2.mjs`, the array-layer path `ktx2Layers`) → ASTC 4×4 on the iPhone, **12.6 MB**. Measured on `concrete.jpg`: ETC1S q100 = 275 KB / layer (≈ 2.5 MB for 9, PSNR 28 dB), UASTC L2 + zstd = 1.4 MB / layer (12.6 MB, 34 dB). Detail ratios are noisy and multiplied at ~0.5 amplitude: ETC1S is enough; UASTC if banding shows |

## LEARNINGS

1. **Store a DETAIL RATIO, not a colour.** Linear texel ÷ local mean, renormalised to mean 1, stored linear as
   ratio / scale. The wash keeps the hue (the round-8 ΔE fit survives), the far mips converge on exactly 1 (a distant
   surface is its flat wash: no repeat can show, no palette drift), and one layer serves every hue (the same tiles on
   malachite and azurite, the same stone on every wash).
2. **Ask the painter for the swatch from the painter's own frame.** v1 swatches styled on the round-8 target crops came
   back photo-granite; codex edits of *our own frames* showed the style's real stone technique (dense dappled dabs,
   slate darks, ochre stains), and swatches styled on crops of those edits (v2) closed most of the gap in one loop. Do
   this first next time: capture → codex edit → swatch from the edit's crop.
3. **Flatten the swatch's big blotches, not its dabs.** Image-model swatches carry 0.3–1 m value blotches that read as
   camouflage and repeat per stone / per tile. A local-mean divide at sigma 3.5–10 % of the size (flatten 0.8–0.9)
   keeps the brush dabs and kills the blotches.
4. **Per-stone windows + `textureGrad` on the world gradients** make a 2.4 m swatch cover a whole plaza with no visible
   repeat (two layers × random offset × quarter turns) and no mip seams on the joints.
5. **The ink must stay procedural.** Every repeated joint / course / slab seam is still ruled in the shader; textures only
   carry what is painted between the lines. Where a texture has its own drawn structure (tiles, the frieze), make the
   rulings match its pitch (`uTilePitch`) or let the texture own that structure (the frieze replaces the inset frame).
6. **Walls are mostly pieces.** On the facade grammar, painting only the shell cells was invisible; the paint has to
   reach the modules, slabs, AC boxes, slats and pipes, world-anchored (x + z, y), or the towers stay clean.
7. **Wet is a surface property**: the ratio's dark dabs are the wet ones — they take the sky sheen and they carry the neon
   reflections (the streak cards multiply by the dapple). That is what makes the codex flags look painted-wet instead of
   uniformly glossy.
8. **Frieze only where it fits.** The clean room uses kind 5 on 190 m ledges, 11 m boxes, AC fronts and painted boards;
   the frieze is limited to balustrade-sized faces, boards get lacquer, the rest plain stone.
9. **What the paint cannot fix (palette / light, not surface)**: the edits' flags are bluer and brighter (luma 0.25 vs
   0.19), the lab stone warmer (spill) and lighter; reflections are stronger in the targets. That is the look loop's
   palette and the neon lab's streaks.
10. **Tooling**: benchmark on/off INTERLEAVED — the GPU is shared with other agents' MPS jobs and a sequential bench
    read +10 ms of pure contention. The dcg hook blocks `> file` redirects: write files with the Write tool.

## Integrating into the clean room (`src/dev/nine-dragon/`)

The lab's copies carry every change marked **`P5 paint`**; the clean room has moved on since, so apply by anchor, not
by line (`grep -n "P5 paint" src/dev/nd-lab/texture/{style,streaks,kit}.ts src/dev/nd-lab/texture/facade/material.ts`).

1. **Module + textures.** Copy `src/dev/nd-lab/texture/paint.ts` → `src/dev/nine-dragon/paint.ts` (no imports but
   three). The textures stay at `/assets/nine-dragon/lab/tex/` (or move them and change the URL).
2. **`main.ts`**, before the first render (the placeholder array works until then; the sampler type never changes):
   ```ts
   const paint = await loadPaint('/assets/nine-dragon/lab/tex', Math.min(8, renderer.capabilities.getMaxAnisotropy()));
   shared.u.uPaint.value = paint.tex;
   ```
   and a debug hook on `window.__nd`: `paint: (k) => { shared.u.uPaintK.value.set(...k); }` (no URL switch).
3. **`style.ts`**:
   - `import { PAINT_GLSL, paintUniforms } from './paint';`; in `Shared.u` add `...paintUniforms()` and
     `uTilePitch: { value: new Vector2(0.24, 0.22) }`;
   - `FS_JIEHUA`: declare `uniform vec2 uTilePitch;` and append `${PAINT_GLSL}` after `${STONES_GLSL}`;
   - after `vec3 base = …`: `float surf = floor(fl / 4096.0); float pk = surf == 1.0 ? 0.0 : uPaintK.x;`
   - kind 1, after `float rowP = …, seed = vPat.w;`:
     `if (pk > 0.0) base *= pInk(paintWall(4, 2, q, 6.0, seed, pk * uPaintK.z * 0.9), uPaintInk);`
   - kind 2: `rp, cp` from `uTilePitch`, then `if (pk > 0.0) col *= paintTiles(q, vec2(cp, rp), pk * uPaintK.w);`
   - kind 3: `vec4 pf = paintFlag(p, pk * uPaintK.y);`, `col = base * (0.82 + 0.3 * st.y) * mix(0.74 + 0.52 * speck, 1.0, pk)
     * pInk(pf.rgb, uPaintInk);`, `wAmt` from `clamp(st.z + (pf.a - 0.5) * 1.6 * uPaintK2.w * pk, 0.0, 1.0)`, and the sheen
     line becomes the lab's (the `dab` factor and `mix(fres, 0.14 + 0.86 * fres, pk)`);
   - kind 5: the lab's `isBoard` / `friezeFace` / `frieze` lines before the inset frame, `(1.0 - frieze)` on the four
     frame / ruyi terms, and the paint block at the end of the branch;
   - before `// ── the wash`: the lab's generic block (explicit `surf` and kind 9 stone). **Drop the lab's wet darkening
     and top sheen there**: the clean room's own "rain-wet stone and decks (vMisc.z)" block now does that. Port only the
     rivulets into that block: `shaded += uFogBaseCol * 0.4 * wet * pk * pRivulet(q, vert);`
   - `jiehuaMaterial(…, { viewmodel: true })`: `u['uPaintK'] = { value: new Vector4(0, 1, 1, 1) };`
4. **`streaks.ts`**: `import { PAINT_GLSL } from './paint';`, `${PAINT_GLSL}` after `${STONES_GLSL}` in `FS_CARD`,
   and `col *= paintWetDapple(p);` after the `vec3 col = …` line.
5. **`facade/material.ts`**: `import { PAINT_GLSL } from '../paint';`, `${PAINT_GLSL}` + `uniform vec2 uTilePitch;` at the
   end of `COMMON_GLSL`'s includes; kind 2 as the lab's (pitch from `uTilePitch`, no running-bond jog, `paintTiles`); and
   before "two hard bands of top light" the lab's generic concrete block (every kind but 2 / 3 / 4 / 5 / 9, world-anchored).
6. **`kit.ts`** (and `hero/kitx.ts`'s flags): `surf?: number` on `Look`, `+ (look.surf ?? 0) * 4096` in the flags.
7. **Looks to mark** (`SURF` from paint.ts): `hero/paifang.ts` `CINNABAR` → `surf: SURF.lacquer`; `stalls.ts` `TIMBER`,
   `dressing.ts:85` and `facades.ts:183` (the `0x4a3a2c` boards) → `surf: SURF.wood`; `square.ts` the plaza lip box →
   `surf: SURF.stone`; optionally the ground-floor piers of `facades.ts` shops → `surf: SURF.poster`. The balustrade
   panels already carry `wet: 0.5` there.
8. **Re-check**: the ink lab's motion test (3 frames on a 0.1 m/s walk, `motion.py`): the dabs are mipmapped + anisotropic
   and the rivulets fade before sub-pixel, so expect no new shimmer; then the look loop's ΔE regions (the means are
   unchanged by construction).
