# Night Market kit models · RM4.9 family boards (2026-10-26, sp-o1)

One labelled iPhone-portrait board per kit family (night-market-remaster-mini-plan.md RM4): the mockup crop it was built
from over four angles of its three variants (FRONT · THREE-QUARTER · BACK · ABOVE). The models are Blender scripts
(`scripts/blender/open-plots/kit.py`, target `open-plots/kit`), rendered here in their default slot colours at dusk; in
the game the layout's palette retints them and the kit material draws their trims (stone courses, roof tiles, timber,
awning stripes). They are **opt-in** (`tiledPlot.mjs` `KIT_FAMILIES` empty) until RM8.1's quantized tiles pay the tile
bytes, so none of this is in the game yet.

| File | Family | Mockup crop | Triangles per variant |
|---|---|---|---|
| `lanterns.jpg` | stone post · paper-lantern bracket · banner post | A2 · 4 | 122 · 182 · 168 |
| `stalls.jpg` | hero stall · red-roofed row stall · food cart | D2 · 7 | 684 · 308 · 510 |
| `houses.jpg` | cottage · two-storey house · porch hall | A2 · 4 | 260 · 466 · 556 |
| `bridges.jpg` | arched half-bridge: rails · parapet · crown lanterns | D2 · 4 | 356 · 284 · 616 |
| `strings.jpg` | gold bulb · small paper lantern · lane post | A2 · 1 | 12 · 56 · 72 |
| `props.jpg` | flower planter · bench · crate stack | A2 · 4 | 185 · 42 · 70 |
| `canal.jpg` | canal coping: plain · bollard · water steps | D2 · 4 | 22 · 52 · 52 |

Open gaps seen on the boards: the planter's flowers are sparse next to the mockup's lush clump; D2's lantern posts carry
a red pagoda cap (a possible fourth lantern look); the mockup's stall roof is a twin-span red canopy.
