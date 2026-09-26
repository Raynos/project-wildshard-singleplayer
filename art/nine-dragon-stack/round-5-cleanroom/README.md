# Round 5: the clean-room spawn, real-time (E169, 2026-09-25)

Shard 4's starting spawn, **Lantern Square (stratum 6/9, +125 m)**, built from scratch in three.js from the mockups and
`docs/design/nine-dragon-stack/ART-STYLE-RESEARCH.md` only, in the **界画霓虹 Jiehua Neon** style: ruled ink lines drawn
inside the material (antialiased with `fwidth`), a depth-silhouette pass, flat mineral washes, banded silk fog, neon
calligraphy as the only saturated light. `2` in the page flips it to the **泥金磁青 gold-on-indigo** sutra look (one
uniform, `uSutra`). The HUD is the live baseline (Driftwood) HUD, rebuilt from `../round-6-baseline-hud/ref-live-driftwood-isle.jpg`.

- Page: `dev/nine-dragon.html` (code in `src/dev/nine-dragon/`). Drag / WASD / MOVE stick to walk the square, click or
  ATTACK to slash (hold = heavy), LOCK targets a brass dragon hook, JUMP with a hook locked fires the Fei Zhua and zips,
  `F` fires at the nearest hook, `H` hides the HUD, `1` / `2` switch Jiehua / sutra.
- Captures: `node scripts/nine-dragon-capture.mjs` (dev server up), one headless Chromium on Metal, muted, driven
  through `window.__nd` (no URL switches), animation frozen at `time(6.5)`.

| File | What |
|---|---|
| `hud-spawn.jpg` | The spawn with the HUD, iPhone portrait 402 × 874 @3× = 1206 × 2622. Compare `../round-6-baseline-hud/style-A-jiehua-neon.jpg` |
| `hud-well-edge.jpg` | On the Well's south ledge looking down the shaft, the claw's line on a dragon hook, LOCK lit with its reticle. Compare `comp-B-well-edge.jpg` |
| `hud-stair-street.jpg` | The stair-street climbing east out of the square, the small paifang at the top |
| `mockup-vs-cleanroom.jpg` | Board: mockup spawn · clean-room spawn · mockup Well edge · clean-room Well edge |

The COMING SOON card art and the slideshow screens (no HUD) are in `src/chunks/thumbs/nine-dragon-stack{,-portrait,-landscape}.jpg`
and `src/chunks/teasers/nine-dragon-stack/0{1-well-edge,2-well-down,3-canyon-up,4-sutra}-{portrait,landscape}.jpg`
(rendered at 1.5–2× and downscaled in the page; every file under its byte cap).

## Numbers (this Mac, headless Chromium, Metal)

- Spawn at 1206 × 2622: **≈ 2.4 ms/frame** (median of 3 × 60 GPU-synced frames: 2.24 / 2.43 / 2.84 ms), **91 draw calls**
  (post passes included), ≈ 600k triangles. Well edge 89 calls, stair-street 64. The phone tier renders at DPR 2
  (804 × 1748); the phone itself has not been measured.
- Frame: quarter-res wet-ground mirror (layer 1: signs, lanterns, the gate, shopfronts) → MSAA ×4 HDR scene + viewmodel
  (depth cleared) → half-res dual-filter bloom → one composite (silhouette, bloom soaked into the silk, shoulder, grain).

## Honest read against the mockups

- **Matches:** the composition (balustrade left, paifang centre, banyan and mahjong right, sign masts over the Well, the
  monorail under an LED sky screen playing a pixelated blue-green mountain painting); the pale silk fog and the Well's
  layers dissolving into it; neon calligraphy with real words; wet flagstones with vertical neon streaks; the gold-on-
  indigo flip (close to round-4 `B-sutra-spawn`); the gondola, nets and catwalks down the shaft; the HUD.
- **Short of the mockups:** it is procedural and low-poly, so it reads as a clean ruled illustration rather than the
  mockups' dense hand-painted detail; the banyan is lumpy low-poly leaf masses; the Fei Zhua and the jian's hand are
  simple rounded shapes; people are simple brush-round figures; the colour script down the Well is subtle (pale bands
  near, slate and indigo only at the very bottom).
