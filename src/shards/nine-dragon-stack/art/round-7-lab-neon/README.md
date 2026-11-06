# Round 7 · lab P2 "neon": the LIGHT of 界画霓虹 Jiehua Neon (E169, 2026-09-25)

A throwaway clean-room lab for everything that glows and everything that mirrors it:

- SDF neon calligraphy;
- the 晕染 bleed bloom;
- wet-ground streaks, with three methods tried;
- red paper lanterns and amber windows;
- drizzle.

The test scene is a short wet street: 8 m wide, a cinnabar paifang, 19 signs on two walls, two lantern strings and lit
shopfronts. It is shot in iPhone portrait, 402 × 874 @3× = 1206 × 2622.

- Page: `dev/nd-lab-neon.html`. Code: `src/dev/nd-lab/neon/`. It imports only `three` and its own folder.
- The page is driven through `window.__lab`:
  - `set({ streak, spill, sign, ground, bleed, hide })`;
  - `shot(name)`, `time(t)`, `pixelRatio(r)`, `snapshot(w, h, q)`;
  - `bench(n)`, `probe(pass, k)`, `overdraw()`, `nanScan()`, `atlasTest(chars)`, `stats()`.
- Capture: `node art/nine-dragon-stack/round-7-lab-neon/capture.mjs <jobs.json>`, with the dev server up and under the lab
  browser lock.

**Result.** At phone size the light matches the targets: signs, streaks, lanterns, windows and drizzle. `final.jpg`
shows, left to right, the final capture, the codex edit of this very frame, and the round-6 mockup, with zoomed crops
below. Measured over the ground (the bottom 40 % of the frame), the final is within the codex targets' range:

| Ground region | Mean L | p90 L | Mean chroma | Saturated px |
|---|---|---|---|---|
| Final | 0.397 | 0.583 | 0.135 | 15 % |
| codex t1 | 0.402 | 0.567 | 0.134 | 17 % |
| codex t2 | 0.453 | 0.617 | 0.142 | 20 % |

What still differs is architecture, which belongs to the other labs: ink detail on the facades, silk texture on the
walls, the LED sky screen.

## Files

| File | What |
|---|---|
| `final.jpg` | **The side-by-side.** Top: final capture · codex edit of my frame (target) · mockup `round-6-baseline-hud/style-A`. Bottom: ground (final · codex · mockup), the 九龍 sign (final · mockup), a lantern |
| `loop-1.jpg` | Mockup · first capture with the three streak methods (cards · planar · screen). Everything was too pale and foggy, and the shopfronts read as flat orange slabs |
| `loop-2.jpg` | The same after fixing card placement, joints and fog. Cards started to win |
| `loop-3.jpg` | Sign close-up vs the mockup: brush fill · monoline skeleton tube · monoline + dark seam |
| `loop-4.jpg` | Signs after thicker strokes, a darker rim, less halo and a plank board. The first lantern was a flat blob |
| `loop-5.jpg` | Cards · **codex t1 / t2 (my frame edited into the style)** · planar. The codex frames showed a dark ground and jagged, striated streaks |
| `loop-6.jpg` | Gain and width tuned to the codex ground stats · codex · mockup |
| `loop-7.jpg` | Ground zoom: two ripple octaves plus grain vs codex, and the far field |
| `loop-8.jpg` | Full frame · codex · signs · the ribbed lantern |
| `loop-9.jpg` | The bleed, A/B: no bloom · light only · light + silk stain (final) · naive luminance bloom · mockup |
| `streak-methods.jpg` | The three streak methods on the final look |
| `bloom-selective-vs-threshold.jpg` | Alpha-weighted bloom vs threshold 1.0 / knee 0.08 vs threshold 0.6: nearly identical (see integration step 3) |
| `target-codex-t1.jpg`, `target-codex-t2.jpg` | My own targets: codex `image_gen` edits of the loop-2 cards capture (the `cards` panel of `loop-2.jpg`). The style paragraph is ART-STYLE-RESEARCH §6 A, placed first |
| `capture-final-spawn.jpg` | The final capture on its own (603 × 1311) |
| `capture.mjs` | The capture / bench script |

## What won, with the exact parameters

### 1. Signs (`glyphs.ts` + `signs.ts`): an SDF brush fill, not monoline, and a procedural frame tube

**The atlas (`GlyphAtlas`).**

- Each character is drawn once from canvas in `"LXGW WenKai TC"` (Kai / brush regular script, the mockups' hand), with
  Kaiti TC, STKaiti, Songti TC and PingFang TC as fallbacks.
- Cells are 128 px, the em is 92 px.
- Two distance fields share one RG8 texture:
  - **R** is the glyph's signed distance (spread 18 px);
  - **G** is the distance to the glyph's Zhang–Suen skeleton (spread 26 px).
- Both come from a JS Felzenszwalb EDT. There is one cell per character, shared by every sign and every colour: the
  colour is a vertex attribute.

**The tube shader.** Per character there is one quad, drawn additive:

- `d = dFill + thicken`, with `thicken 0.022 em`: the Kai strokes are thin, and the mockup's are fat;
- a pastel core `mix(hue, white, 0.5)`;
- a saturated rim `hue × 0.62`, `rim 0.024 em`: the darker glass edge the mockup shows;
- a halo that stays inside the quad: `haloReach 0.12 em`, `haloGain 0.22`;
- `gain 4.2` (HDR);
- `fwidth` antialiasing, so the glyphs are crisp at any size.

**The board shader.** One opaque draw covers every board and bracket:

- the board is `#34333a` ink with planks every 0.19 m and grime noise;
- it is lit by its own tube (`boardLift 0.035 × hue`);
- the neon frame is a rounded-rect distance in metres: `inset 0.075`, `tube radius 0.016`, corner radius 0.04, plus a
  0.04 m glow;
- four rivets, and a ruled ink edge;
- blade signs hang on iron brackets: a top arm, a diagonal strut, hangers and a bottom tie.

**The palette** (§5.1) is magenta `#ff3fa4`, cyan `#3fe6ff`, jade `#33f0b0`, hot red `#ff3b30` and amber `#ffb347`.
Two signs flicker.

- Monoline tubes (`mono: 1`, the skeleton distance with a 0.045 em radius) render correctly, and look like real Hong Kong
  bent glass. **But the mockups draw brush-shaped fills with a rim**, so the fill won. Monoline stays as a switch.
- The "darker core line" (`seam`, a dark line along the skeleton) is invisible at phone size, so it is off (0).

### 2. Wet-ground streaks (`wetground.ts`): **reflection cards** win

There is one instanced additive card per emitter: 39 of them (19 signs, 17 lanterns, 6 shopfronts).

**Placement is optics, not art.**

- The emitter's top and bottom reflect at `s = D·c / (c + h)` of the way from the eye, where `c` is the eye height and
  `h` the height above the ground.
- The card spans that body, then gloss tails run toward the eye (`tailNear 0.9`, a fraction of the way to 0.6 m) and to
  the wall base (`tailFar 0.95`).
- Width is `0.6 ×` the sign width × `s / D`.

So a sign above the top of a portrait frame still drops its streak into the bottom of the frame, exactly like the
mockups.

**The look.** These values came from the codex zoom:

- The streak edge is jagged. A sideways ripple uses two octaves along the ray (38 and 95 cycles/m), each faded out
  before it aliases (`fwidth` of the along coordinate), plus a 14 /m wobble in the far field, at amplitude
  `fine 0.32`.
- Inside the streak there is fine vertical striation, horizontal ripple dashes (`cardDash 0.35`) and a per-stone jog
  (`cardJog 0.35`).
- The stone's grain shows through the reflection.
- Joints cut the streak (×0.2).
- Fresnel is `0.3 + 0.7(1 − V.y)³`.
- `cardGain 1.5`.
- Hue is kept: the streak is never pushed toward pastel.

**The ground.**

- Dark wet slate: `#6d717b` × per-stone value × speckle, darkened 55 % where wet (puddle noise).
- A silk sheen of 0.3 × fresnel.
- Constant-pixel ruled joints, which fade to wash under ~4–9 px spacing.
- Drizzle rings: ruled circles, one per 1.1 m cell.

**The other two methods.**

- `planar` works: a ¼-res mirror of the emissive layer, then two one-way smears (1.6 and 9 texels), sampled
  projectively with ripple and dashes. But its streaks are short and sparse, because a mirror only reflects what is
  under the sign, and the long streak is a gloss effect. It also costs +4 draws and a scene re-render.
- `screen` (the half-res emissive mirrored about the horizon in the composite) **fails in portrait**. The signs above
  the frame's top have no pixels to mirror, so the near streaks vanish. It is kept only as a switch.

### 3. The 晕染 bleed bloom (`bleed.ts`)

**The pyramid.** A Karis-weighted prefilter at ½ res, 4 dual-filter downs to 1/32, and 3 ups back to ¼. There are two
outputs:

- **tight**: the ¼ mip, weight 0.16;
- **wide**: the summed pyramid, weight 0.4.

**The composite** does everything in one pass:

- **Pigment.** The wide mip's hue *multiplies* pale paper (`stain 0.5`, `response 2.2`, only where scene luminance is
  above ~0.35). A halo on silk therefore stays magenta instead of washing to white.
- **Wet front.** The edge darkens where the stain stops (`edge 0.12`).
- **Soak.** The silk weave modulates the bloom (±25 %), and a slow fibre warp (0.004 uv) frays the edge.
- **Light.** tight + wide are added.
- **Tone.** A hue-preserving shoulder divides by the max channel, so saturated stays saturated and only the pastel tube
  cores go light.

`loop-9.jpg` shows the A/B. The effect is deliberately subtle, like the mockup's. A naive luminance bloom fogs the whole
wall pink.

**Selection.** The lab weights the bloom by alpha, where materials write their glow. **Threshold 1.0 / knee 0.08 gives
nearly the same frame** (`bloom-selective-vs-threshold.jpg`), because neon runs at ×4.2. Use the threshold in the clean
room and leave alpha free for the silhouette lab's surface IDs.

### 4. Lanterns (`lanterns.ts`)

- **Draws.** One instanced draw holds the body, the lacquer caps and the tassel, told apart by `aPart`. The cables are
  ribbons of constant pixel width (1.4 px at 3×, ink `#16171b`).
- **Paper.** It glows `mix(rim #9a0e0a, hot #ff6a3c, pow(N·V, 2.2))` × 1.5 HDR, plus a candle hot spot
  `pow(N·V, 7) × 0.55`.
- **Detail.** 16 bamboo ribs, antialiased, and dark trim bands at the top and bottom.
- **Motion.** A slow sway.

### 5. Windows and drizzle

- **Windows.** Amber `#ffb45a` × 1.25 HDR, in about 20 % of 1.6 m modules. Shopfronts are a dim warm interior with a dark
  counter band.
- **Drizzle.** Two screen-space layers of ruled hairlines in the composite, at 8° from vertical, about 1 device px wide,
  strength 0.55. They take **zero draws** and pick up the bloom colour they cross.

## Cost

Measured on this Mac (M5 Max) in headless Chromium on ANGLE-Metal. Timer queries are unreliable here, so these come from
`readPixels`-synced frame times, toggles, and slopes of k repeats. **No phone was measured.**

| | 1206 × 2622 (DPR 3) | 804 × 1748 (DPR 2) |
|---|---|---|
| Whole lab frame, spawn | **1.40–1.52 ms** median | **1.00–1.18 ms** |
| Draw calls | **17**: sky, ground, walls, boards, tubes, lanterns, cables, cards + 9 post (prefilter, 4 down, 3 up, composite) | 17 |
| Triangles | 15.4 k | 15.4 k |
| Per-pass slope: world / cards / tubes / lanterns / bloom | 0.76 / ≤ 0.47* / 0.16 / 0.14 / 0.06 ms | 0.37 / 0.23 / 0.07 / 0.09 / 0.06 ms |
| Toggles (Δ median) | bloom off −0.08 (−7 calls), neon spill loop off −0.14, cards off ≈ 0, drizzle off ≈ 0 | |
| `planar` instead of cards | +4 calls (21), +11 k tris (a mirror re-render), ≈ 0 ms here | |

\* The card slope includes a reload of the MSAA ×4 half-float target on every repeat, so it is an upper bound.

- **Overdraw** of the additive passes (cards + tubes), counted 1/255 per layer:
  - spawn: mean 0.87 layers/px, 42 % covered, max 6 at the bottom edge where the near tails converge;
  - ground view: mean 1.16;
  - signs view: 0.28.
- **NaN scan** of the half-res prefilter: 0 non-finite texels on spawn, signs and ground. Every `pow` base is clamped.
- **Atlas build:**
  - 16 glyphs (512²): 80–100 ms;
  - **the clean room's full word list, 101 glyphs (2048² RG8): ~265 ms** on this Mac. On a phone that is likely ~1 s at
    load, so bake it (integration step 1).
- **Phone estimate, not measured.** The light-specific passes are cards, tubes, lanterns, bloom and composite: about
  0.3–0.5 ms here at DPR 2. If a Pro iPhone GPU is roughly 1/10 of this, that is ~3–5 ms at DPR 2, most of it the
  full-screen composite plus the cards' noise ALU.
  - Bloom is the cheapest piece.
  - The neon **spill loop (16 lights per pixel) is the most expensive** relative to its value: bake it.
  - Measure on a device with `__lab.bench` / `probe` before trusting these numbers.

## LEARNINGS

1. **Make your own target by editing your own capture.**
   - The round-6 mockups have a different street, so they only told me "more streaks, more glow".
   - The codex edits of *my* frame (`target-codex-t*.jpg`, ~1–1.5 min each) kept the geometry. That made the gaps
     measurable crop for crop, and the ground stats could be matched numerically.
   - The two decisive findings came from them: the ground must be **dark** (L ~0.3), and the streak edge must be
     **jagged** (a high-frequency sideways ripple).
2. **Streaks are gloss, not mirror.**
   - A long vertical streak is the blurred reflection of an emitter along the view ray. Placing it by optics
     (`D·c / (c + h)`) and stretching it by roughness gives the mockups' look for 1 draw.
   - A planar mirror gives the geometrically "right" image, but it reads as short, sparse reflections.
   - A screen-space mirror cannot work in portrait: the reflected signs are above the frame.
3. **Neon on silk dies by addition.** Adding a halo to pale paper goes pink-white. Model the outer halo as pigment
   (multiply toward the hue on pale paper), add only the tight halo as light, and tonemap by the max channel. Then
   saturation survives.
4. **Screen-constant bloom swamps small signs.** Distant signs lost legibility until the tight bloom dropped (0.55 →
   0.16) and the halo moved into the SDF shader, where its reach is in em and scales with the sign.
5. **The brush font needs thickening.** Kai at 700 weight is thinner than the mockup's painted strokes: dilate the SDF
   by 0.022 em. The darker glass rim sells "tube", and the monoline skeleton sells "real neon". Keep both as switches:
   the mockups chose the fill.
6. **Pale fog kills neon.** Loop 1 was washed out at fog density 0.018. At 0.0085 (max 0.88), with a darker ambient
   (`#8f98aa`), the neon sits on mid-value masses (§4.1 risk 4).
7. **Measure fill by counting.**
   - The first overdraw count said 173 layers. That was the gold-paint plaque's colour leaking through an early
     `return` in the counting shader: put the count switch first.
   - The real maximum is 6.

## Integration into the clean room (`src/dev/nine-dragon/`)

The modules are self-contained. They read `uTime`, `uCam`, the fog uniforms and `uGroundY` from a shared uniform
object. Copy them rather than importing from `nd-lab/`.

**0. Fog shim.** My programs call `fogCol(wp)` and `fogAmt(wp)` (the `FOG` chunk in `glsl.ts`). In the clean room, swap
that chunk for `FOG_GLSL` (`style.ts`) and write each fog mix as:

```glsl
vec4 fg = silkFog(vWorld, 1.0);
col = D * fg.a + fg.rgb;
```

Keep neon at half strength with `E * sqrt(max(fg.a, 1e-4))`, as `FS_NEON` already does with `vNeon.z`. Wire `uCam` and
`uTime` to `Shared.u`.

**1. Signs.**

- Copy `glyphs.ts`, and `signs.ts` as `neonsigns.ts`.
- In `signs.ts` `SignBuilder.place()`, route `spec.style === 'tube'` to:
  `neon.add({ text, color, vertical, em: p.size, at: p.at, facing: p.normal, twoSided: p.blade === true, gain, flicker })`.
- Skip the `kit.boxAxes` board for those signs: `NeonSigns` draws the board and frame itself.
- Build `new GlyphAtlas(chars(WORDS…))` after `loadFonts()`.
- **Bake the atlas** before phone use (~265 ms here for 101 glyphs). Either dump `atlas.texture.image.data` once to a
  2048² RG PNG and load it, or build it in a Worker with OffscreenCanvas.
- The mono atlas and `neonMaterial` stay for lightboxes, drones and the colour pieces.
- This adds 2 draws (boards, tubes) and removes the tube cells from the 2048×4096 mono atlas.

**2. Streaks.**

- Copy the card program plus `STONES` and `buildCards()` from `wetground.ts` as `streaks.ts`.
- Build the emitters:
  - `signs.lights` (add `w`, `h` and `power`: `NeonSigns.emitters` already has them);
  - each `ctx.lanterns` position, as `{ w: 0.5, h: 0.5, power: 0.9 }`;
  - lit shopfronts, as `{ w: 2.2, h: 2.6, power: 0.55 }`.
- `scene.add(buildCards(emitters))` with `renderOrder` after the ground, and `uGroundY = Y0`.
- Then remove the quarter-res mirror: `Pipeline.render` step 1 (`this.reflections = false`, `uReflOn = 0`), and the
  9-tap `uRefl` smear in `style.ts` `kind == 3`. That saves a scene render and the layer-1 bookkeeping.
- Make the square's flagstones use `STONES`, or give the cards the square's joint function, so both break on the same
  joints.
- Set the wet ground to `#6d717b`-ish, 55 % darker where wet, with a sheen of 0.3.
- Limit: the cards assume one flat ground height. For the stair-street and other terraces, add a per-card ground `y`
  (make `aE` a vec4).

**3. Bleed bloom** (`post.ts`).

- Keep the prefilter as a **threshold of 1.0, knee 0.08** (`bloom-selective-vs-threshold.jpg`), so alpha stays free for
  surface IDs.
- Keep the dual filter, but hand the composite **two** samples: `tTight` (the ¼ mip) and `tWide` (the summed pyramid).
- Paste the 晕染 block from `FS_COMPOSITE`: the pigment glaze on paper, the wet-front edge, the weave soak, the fibre
  warp, and `tight × 0.16 + wide × 0.4 / 4`.
- Replace `shoulder()` with `shoulderHP()`.

**4. Lanterns.**

- Replace `lanternKit()` on `jiehuaMaterial` with `Lanterns`: `hang(matrixPosition, scale)` for each `ctx.lanterns`
  matrix. The clean room's pivot is the hook, which is my `top`.
- Use `string()` for new strings across a street.
- Cost: +1 program, 1 instanced draw.

**5. Drizzle.** Paste `rainLayer()` and its two calls into the composite. You can then drop `rainGeometry(2400)` and
`rainMaterial`: −1 draw and less transparent overdraw. Or keep the world-space rain for parallax.

**6. Neon spill.** Don't ship the 16-light uniform loop (`LIGHTS`). Bake `Σ emitter.color × spill / (1 + r² / R²)` into
the kits' vertex colours at build time (TECHNIQUES §6.1), with `R = 2.2 · max(w, h) + 1.5` as in
`LabShared.setLights`. Keep ≤ 4 pooled dynamic points, for the lanterns nearest the player.
