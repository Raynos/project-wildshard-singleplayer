# Signal Dunes round 29: the LUT re-fit on the current look (the original top-10's row 10)

Jake (2026-10-03): finish the original top-10; row 10 is the LUT re-fit on the current look, per region, verified on
h1-h4, the aerials and the clip, **shipped only if it holds up**. It did not hold up, so nothing shipped: the shard keeps
no LUT (`look/render.ts` `lut: null`; `public/assets/lut/sunscar-dunes.bin` is round 24's file, still a declared late read).

Two fits, both by `scripts/fit-lut.py` from the five council mockups (`../round-24-lut/mockups`) against the game's `mock-*`
captures without a LUT at 185079cef's look (round 25's terrain and light):

| Fit | Regions | ΔE00 worst without → with | Per region (with) |
|---|---|---|---|
| A | `regions.json`: round 24's, the near-sand boxes trimmed to x 0.02-0.30 (clear of the coil), the sunset dunes weighted 3 | 8.7 → 3.7 | sunset sky 8.7 → 3.7, late sky 1.4 → 1.3, sunset dunes **1.7 → 3.7**, sunset near sand 3.8 → 1.6, late near sand 4.5 → 2.8 |
| B | `regions-b.json`: A without the late near sand | 8.7 → 6.6 | sunset sky 3.5, late sky 1.5, sunset dunes 4.0, sunset near sand 1.3, late near sand **6.6** |

What it does to the frames (both fits, `clip-no-lut-fitA-fitB.jpg`: the clip at 2 s and 6 s, no LUT | fit A | fit B):
- **The spawn pair's sky** moves to the mockups' (A: 137,69,67 → 112,69,65 against 117,71,70; saturation 0.59 → 0.52 against
  0.47). That is the gain.
- **The lit sand** turns yellower (A's lit quarter h23 → h29 against the mockup's h21), and the shade pinker (h342 → h356).
- **The late clip goes milky**: the sky's correction (less red) lands on every dark red-violet tone, so the late land lifts into a
  low-contrast haze, and a greenish band opens in the sunset sky's transition. A LUT can't tell the sunset sky from the
  dusk land of the same hue. That milky lilac wash is what the lead ruled against in round 21.

h1-h4 and the aerials show no banding or posterising with either fit. The clip fails, so the re-fit is not shipped. A grade that
fixes the sunset sky alone belongs in the painted sky itself (`../round-25-sky/prep.py`), not in a screen-space LUT.
