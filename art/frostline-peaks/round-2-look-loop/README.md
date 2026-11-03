# Frostline Peaks · round 2 · the look loop (OB3, G983, 2026-11-03, sp-o1)

LOOK-LOOP's nine angles about the anchor P = (0, -75): the south lane, 75 m south of the peak (its foot reaches 46 m),
between two pine woods. Four first-person views from P (front faces the peak), straight down, and four aerials 55 m out
and 45 m up; 9-diag-back stands past the peak at (55, 60, 40). Captured in the engine on the phone tier at 2x, as an
iPhone 16 Pro (`nine.mjs`, from sp-o3's Mosslight loop). The targets are codex `image_gen` edits of each R2 capture,
with round 62's `art/grid/round-62-open-plot-palettes/16-frostline-peaks.jpg` as the style reference.

| File | What |
|---|---|
| `sheet-r2.jpg` | R2: after look rounds 1 and 2 (72510868fb) |
| `sheet-t0.jpg` | T0: the nine targets |
| `sheet-r3.jpg` | R3: after this round's fixes |
| `board-r3.jpg` | R3's BEFORE (R2) · AFTER · TARGET for four of the angles |

## Rounds 1 and 2 (the dome captures, 17389ab93f)

- **Dark cubes at L1.** The shared coarse box took its colour from up-facing faces; a steep snow roof or a pine has
  almost none. Frostline draws its own stand-ins: a snow-tipped pyramid per pine clump, a gabled lodge.
- **Night Market reds.** Stall wood, white awnings and warm-amber bulbs.
- **D1 and D2 domes failed** ("anchor drifted"): the template anchors stood on and inside the 70 m peak. Moved to the
  plaza band and the lift base (a887520c54).

**Ruling (G872): R2 shipped** (72510868fb, phone wire +22.5 KB approved by wildshard-new).

## R3 gap list (R2 against T0) and fixes

- **The peak reads lavender** (T0: grey granite under white snow). The landmark's texture (near and far) is pulled
  toward its own grey (35 % saturation) and its dark rock warmed (x 1.1 / 1.04 / 0.86, weighted by darkness), so the
  blue ambient no longer turns it periwinkle. Re-encoded at WebP 80.
- **Night Market's red banner posts and bulb strings on every lane** (round 62 has neither). Frostline's lanes are its
  own: one lantern post at each end of a seam, on alternate sides, none on the peak's foot or over the road entries.
- **A grey cast over everything.** R3 changed the ambient in the plot's template only; the runtime reads the look
  keys from the plot's `outputs.json` row, so it did not take effect until R4.

**Ruling (G872): R3 ships.** It closes the peak and lane gaps. Draws are unchanged (86-144 a view). The phone wire
falls from 6.31 MB to 5.98 MB (the peak texture and the strings), and its ceiling ratchets down to that.

## R4 gap list (R3 against T0) and fixes

| File | What |
|---|---|
| `sheet-r4.jpg` | R4: after this round's light |
| `board-r4.jpg` | R4's BEFORE (R3) · AFTER · TARGET for four of the angles |

- **The ground reads mid-grey** (T0: bright white snow), the biggest gap. The look keys (recipe, template and the
  `outputs.json` row together): sun 1.7 -> 2.2, ambient 1.1 -> 2.2 and whiter (sky 0.80 / 0.86 / 0.97, ground
  0.92 / 0.93 / 0.95). The paving now reads pale snow-white; the peak's snow does not blow out.
- **A pale sky** (T0: deep cobalt). Zenith 0.03 / 0.14 / 0.58, horizon 0.45 / 0.64 / 0.95, the fog matched to the
  horizon. It reads blue at the top of a first-person frame, still lighter than T0.

**Ruling (G872): R4 ships.** Light only: no bytes, no draws.

## Still open

- **Bare dark pines** (T0: snow on every tier): the kit's pine model, a mesh change.
- **No long blue shadows on the snow** and the sky still lighter than T0's cobalt.
