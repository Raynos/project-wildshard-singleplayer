# hud / round-20-accent-palette: 20 shard accents and a reserved road colour (G87)

G87 says each shard picks one of 20 HUD accent colours, and the road / safe zone uses a reserved 21st colour that no shard
can pick. **Questions: (1) is this the palette of 20? (2) which colour is the road's? (3) which accent does each shard
take?** Only the accent changes: the navy glass `#0d1b26` at 80 %, the white labels and the layout stay the same in every
shard.

| File | What it shows |
|---|---|
| `palette.jpg` | The 20 accents, 01 EMBER to 20 SAND. Each one sits on a HUD-size navy-glass chip over a live Driftwood frame, with its hex and its WCAG contrast ratio for label text on solid navy. Below them are three candidates for the reserved road colour, each on the "SAFE ZONE" chip: R1 HUD CYAN `#8fe3ff`, R2 SIGNAL SILVER `#e4e9ee`, R3 SAFETY AMBER `#ffb020` |
| `b-A-moss.jpg` … `b-D-iris.jpg` | Pine Hollow's trader screen (Mott's stall, the big-cards kit from round 19 B) in four accents: A 08 MOSS, B 05 MARIGOLD, C 01 EMBER, D 15 IRIS |
| `board.jpg` | Pick board (b): the four accents of the trader screen side by side |
| `c-<shard>.jpg` | Each shard's live HUD in its suggested accent (fresh HEAD captures, recoloured) |
| `board-shards.jpg` | Pick board (c): one suggested accent per shard, as a HUD crop of each (top: minimap and quest chip; bottom: the action bar) |

**The palette:** the 20 accents are spread round the hue wheel, and each one alternates lightness and chroma with its
neighbours so that no two look alike. The closest pair is 01 EMBER and 03 TANGERINE, at OKLab ΔE 0.062. Every accent has
a contrast of at least **6.8 : 1** on solid navy (WCAG AA needs 4.5). Even the worst case, the 80 % glass over a white
sky, keeps at least 3.6 : 1. The cyan band (OKLCH hue ≈ 195–235°) is left empty, so the road colour never collides with a
shard's accent. The round-1 draft had a light 12 SKY, which read too close to the road cyan on the HUD (the Sky Reach
crop showed it). 12 SKY became the deeper **12 AZURE** `#5ca3fd`.

| # | Name | Hex | # | Name | Hex |
|---|---|---|---|---|---|
| 01 | EMBER | `#fe8169` | 11 | TEAL | `#54cec2` |
| 02 | CORAL | `#fe9b98` | 12 | AZURE | `#5ca3fd` |
| 03 | TANGERINE | `#ff9550` | 13 | CORNFLOWER | `#a5acfe` |
| 04 | APRICOT | `#f8bd84` | 14 | PERIWINKLE | `#ccccf8` |
| 05 | MARIGOLD | `#fbbb2d` | 15 | IRIS | `#bc8bfe` |
| 06 | CITRON | `#efe345` | 16 | LILAC | `#dda9f7` |
| 07 | LIME | `#ade74e` | 17 | ORCHID | `#e989e1` |
| 08 | MOSS | `#89c06a` | 18 | PINK | `#f9add0` |
| 09 | JADE | `#59e1a2` | 19 | ROSE | `#fc7b9d` |
| 10 | MINT | `#99f0ca` | 20 | SAND | `#beaf91` |

**Recommended:**
- **The palette as drawn.**
- **Road colour: R1 HUD CYAN `#8fe3ff`.** Today's HUD becomes the platform's own colour. You see it on the road and in
  every menu, and each shard tints it. It is clear of all 20 accents. R3 SAFETY AMBER is too close to 05 MARIGOLD and
  reads as a warning. R2 SIGNAL SILVER is very close to the white labels, so the "SAFE ZONE" chip loses its identity.
- **Board (b): A, 08 MOSS** for Pine Hollow. It matches the moss on the roofs and the pines, and it reads calmly on the
  big cards. EMBER and IRIS fight the forest; MARIGOLD works, but Driftwood needs it more.
- **Per-shard picks (board c):** Driftwood **05 MARIGOLD** (sun and sand), Pine Hollow **08 MOSS**, Nalati **01 EMBER**
  (dusk on the steppe, red felt), Signal Dunes **17 ORCHID** (magenta against the indigo dusk), Sky Reach **18 PINK**
  (the golden-hour clouds), Nine Dragon Stack **15 IRIS** (neon violet), the template **20 SAND** (neutral). Every pair of
  grid neighbours (Driftwood–Pine, Driftwood–Nalati, Driftwood–Dunes, Driftwood–Sky Reach) is clearly different.

**How they were made** (ask E438, SHARD-PLATFORM mockups, 2026-10-04). `palette.jpg` is drawn in code (PIL with SF Mono)
so the hex values and contrast figures are exact. The colours are OKLCH picks clipped to sRGB, with WCAG 2 contrast and
OKLab ΔE computed. Its backdrop is a fresh capture of the HEAD build `5ab6a3c08` (`serve-build.sh --head`, taken as an
iPhone 16 Pro, 402 × 874 @3×, muted, through the browser lane). The trader frames are codex `image_gen` accent-only
edits of `art/hud/round-19-ui-kit/B-big-cards-accent.jpg`. The per-shard frames are codex accent-only edits of fresh
captures of each shard from the same build. Every UI string was quoted. Re-rolls: Sky Reach was regenerated in 18 PINK
after its first roll in 12 SKY read too close to the road cyan. Nine Dragon Stack was rolled twice and roll 1 was kept,
because roll 2 zoomed the camera in. These are mockups only: nothing here is built, and a real
HUD change goes over herdr first (E332).
