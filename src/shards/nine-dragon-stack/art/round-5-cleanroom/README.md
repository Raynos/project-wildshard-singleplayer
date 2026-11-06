# Round 5: the clean-room spawn, real-time (E169, 2026-09-25) — v2 detail pass

Shard 4's starting spawn, **Lantern Square (stratum 6/9, +125 m)**, built from scratch in three.js from the mockups and
`docs/design/nine-dragon-stack/ART-STYLE-RESEARCH.md` only, in the **界画霓虹 Jiehua Neon** style: ruled ink lines drawn
inside the material (antialiased with `fwidth`), a depth-silhouette pass, flat mineral washes, banded silk fog, neon
calligraphy as the only saturated light. `2` in the page flips it to the **泥金磁青 gold-on-indigo** sutra look (one
uniform, `uSutra`). The HUD is the live baseline (Driftwood) HUD, rebuilt from `../round-6-baseline-hud/ref-live-driftwood-isle.jpg`.

- Page: `dev/nine-dragon.html` (code in `src/dev/nine-dragon/`). Drag / WASD / MOVE stick to walk the square, click or
  ATTACK to slash (hold = heavy), LOCK targets a brass dragon hook, JUMP with a hook locked fires the Fei Zhua and zips,
  `F` fires at the nearest hook, `H` hides the HUD, `1` / `2` switch Jiehua / sutra.
- Captures: `node scripts/nine-dragon-capture.mjs --url=<a private dev server on a clean export> [--v1=<dir>]`. One
  headless Chromium on Metal, muted, driven through `window.__nd` (no URL switches), animation frozen at `time(6.5)`.
  Capture from your own port: the shared :5173 reloads when other agents edit files (it killed one v2 run).

| File | What |
|---|---|
| `hud-spawn.jpg` | The spawn with the HUD, iPhone portrait 402 × 874 @3× = 1206 × 2622. Compare `../round-6-baseline-hud/style-A-jiehua-neon.jpg` |
| `hud-well-edge.jpg` | On the Well's south ledge looking along and down the shaft, the claw's line on a dragon hook, LOCK lit with its reticle. Compare `comp-B-well-edge.jpg` |
| `hud-stair-street.jpg` | The stair-street climbing east out of the square, the small paifang at the top |
| `mockup-vs-cleanroom.jpg` | Board: mockup spawn · clean-room spawn · mockup Well edge · clean-room Well edge |
| `v1-vs-v2.jpg` | Board: v1 (`54d8776`) · v2 · mockup, for the spawn (top row) and the Well edge (bottom row) |

The COMING SOON card art and the slideshow screens (no HUD) are in `src/chunks/thumbs/nine-dragon-stack{,-portrait,-landscape}.jpg`
and `src/chunks/teasers/nine-dragon-stack/0{1-well-edge,2-well-down,3-canyon-up,4-sutra}-{portrait,landscape}.jpg`
(rendered at 1.5–2× and downscaled in the page; every file under its byte cap).

## What v2 changed

- **Density:** every facade bay is dressed from 10 instanced kit pieces (balconies with ruled railings, window cages,
  potted plants, striped awnings, laundry poles, rooftop shacks and water tanks, lit sign boxes, drain pipes, shutters),
  one InstancedMesh per piece and region, plus cable bundles and air-con boxes. The facade shader breaks the window grid:
  wide, twin, recessed-balcony and small windows, curtains, transoms, warm amber / cool / TV-lit interiors.
- **Layout re-planned to the mockup's proportions:** a narrower square (22 m), the paifang 1.85× taller and centred
  (the gold 九龍 plaque, malachite roofs, lanterns under every lintel), neon masts on the Well's lip carrying big
  legible 九龍 · 牙科 · 火鍋 · 茶 · 藥房 · 麻雀 down the left edge, hero signs on the right, glazed pent roofs and lanterns
  over every shopfront, lantern strings across the square, a crowd of ~50 (umbrellas, bamboo hats, seated players).
- **Neon:** the tube core carries the HDR gain and the halo very little, so characters stay legible and bloom paints
  the glow; bloom only above 1.0 with a tight knee.
- **Wet ground:** a two-pass one-way streak of the quarter-res mirror, so every sign and lantern drips a long
  saturated streak; a darker wet wash.
- **Hero props:** a gnarled five-strand banyan trunk with buttress roots, ~70 aerial roots, a layered smooth canopy,
  wish ribbons; round brush-shaded people.
- **Weapon:** a detailed dragon-head guard (horns, mane plates, whiskers, fangs, glowing eyes), a dark slender blade with
  thin cyan edges, the red tassel and the 鎮邪 talisman hanging in frame; the Fei Zhua on a cloth-wrapped, cord-bound
  forearm with leather straps, a lacquer-and-brass housing and three long hooked talons.
- **Lines:** heavier near the camera. **Render bug fixed:** the viewmodel was drawn after `clearDepth()`, so the
  silhouette pass only ever saw the weapon's depth and the world got no depth outlines. The viewmodel now renders into a
  near depth slice (`gl.depthRange`), no clear, no copy; checked with the silhouette layer alone, weapon on and off.
- **The Well:** looked along the shaft from the south ledge (stone balustrade low in frame), dense balconies, nets,
  catwalks, the gondola, the yamen with its lantern row over the jade Sump; the air takes the colour script of the
  strata it looks into (deeper = bluer, to indigo), the lower strata's lines turn to glowing gold.

## Numbers (this Mac, headless Chromium, Metal)

- Spawn at 1206 × 2622, **v1 vs v2 back to back in a quiet GPU window**: v1 2.18–2.39 ms/frame (91 draws, 0.60 M tris),
  **v2 2.64–2.87 ms/frame (118 draws, 1.07 M tris)**. Well edge 118 draws, stair-street 83.
- Other agents' model jobs share the GPU: under that load the same frame read 5–19 ms (both builds slow down alike), so
  only the back-to-back A/B is a real number. The phone itself has not been measured.
- Frame: quarter-res wet-ground mirror (layer 1) + two streak passes → MSAA ×4 HDR scene with the viewmodel in a near
  depth slice → half-res dual-filter bloom (7 mips) → one composite (silhouette, bloom soaked into the silk, shoulder,
  grain).

## Honest read against the mockups

- **Matches now:** the composition (balustrade leading in on the left, the red paifang centred with its 九龍 plaque,
  the banyan to its right, the neon column down the left edge, the monorail and sky screen overhead), warm lit windows
  and lanterns against the cool silk, the dripping wet ground, the dense clutter across the Well, the gold-on-indigo flip.
- **Still short:** the mockups are hand-painted illustrations; this is procedural low-poly with ruled lines. The banyan
  is smooth leaf masses rather than a painted tree, the people are simple figures, the gauntlet's talons are straighter
  than concept 08's, and the colour script down the Well is a gradient more than counted bands.
