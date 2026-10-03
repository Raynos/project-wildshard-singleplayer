# Signal Dunes round 24: the learned LUT (E407 top-10 row 10)

The shard's colour grade is a 33³ LUT (`public/assets/lut/sunscar-dunes.bin`, read by `look/render.ts` through
`loadLUT`), fitted by `scripts/fit-lut.py` from the council's five mockups against the game's own `mock-*` captures with
no LUT applied.

| File | What it is |
|---|---|
| `mockups/mockup-1-C-dusk-signal-fire.jpg` … `mockup-5-D-hands-whip.jpg` | the five council mockups (frames 1 dusk-fire, 2 A, 3 B, 4 C, 5 D), copies of `round-2-dunes/` and `round-9-review/` |
| `regions.json` | the material regions the fit matches (sunset / late sky, sunset dunes, sunset / late near sand), clear of the HUD and the held glove |
| `board-pred.jpg` | row 1: the mockups; row 2: round 15's captures (662e6e99b) without the LUT; row 3: the fit's prediction with it |

The fit's source captures are round 15's (662e6e99b): the key inside the glow and the wind away from the camera. An
earlier fit, on round 14's frames with the swung key, brightened every view by 7-12 luma and was never shipped.

Measured on the captures after the LUT (`scripts/palette-delta.py`), ΔE00 without → with:

| Region | Without | With |
|---|---|---|
| sunset sky | 5.8 | 2.9 |
| late sky | 1.3 | 1.0 |
| sunset dunes | 1.8 | 1.5 |
| sunset near sand | 1.4 | 1.1 |
| late near sand | 1.8 | 1.3 |
| **worst** | **5.8** | **2.9** |

Re-fit it whenever the look moves far enough that the without-LUT frames change (the key, the wind, the sky):
`python3 scripts/fit-lut.py --shard sunscar-dunes --regions art/sunscar-dunes/round-24-lut/regions.json
art/sunscar-dunes/round-24-lut/mockups "<captures>/{n}.png"`, with the five `mock-*` captures from
`art/sunscar-dunes/progress/cameras.json` saved as 1-5 in the frame order above.
