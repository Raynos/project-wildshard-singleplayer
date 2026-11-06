# Sky Reach round 24: a green, varied meadow (E407 top-10 row 4)

The board for plan row 4 (`project/archive/2026-10-03-sky-reach-top10.md`). BEFORE is the round-12 surface
`progress/far-reach/20261003-0608-591bd5b5`. AFTER is a phone-tier iPhone-portrait capture of HEAD plus the row-4 files.
The AFTER hero and aerial views also show other agents' work that landed on HEAD in between (the islands, the fan), so
compare the grass there, not the islands.

- `ground-before-after.jpg`: the lower-left ground patch (x 0-0.55, y 0.58-0.86) of the five council views. Rows are the
  mockup, before and after.
- `views-after.jpg`: the five mockups above the five game views after the change.
- `hero-views-before-after.jpg`: h1-h4 and the two aerials, before and after. It checks that the meadow holds up from
  every spot, not only from the council cameras.

## What changed

- The sward atlas (`world/swardAtlas.ts`, drawn in code, 1152 x 512 RGBA, about 3.1 MB with mips, up from
  1024 x 512) now has three grasses, two tufts each:
  - a fine low lawn;
  - broad arching blades with a lit edge (the B channel stores the position across the blade);
  - wild grass with a few seed stalks.
- `world/meadow.ts` places the three grasses by a noise field and by slope: lawn on the slopes of the rises and on the
  worn ground, wild grass toward the rims. Each grass has its own height (lawn 0.20-0.38 m, broad 0.34-0.60, wild
  0.50-0.90). Each blade runs from dark green roots through a green body to warm tips.
- Some strands catch the low sun, chosen by each strand's own shade. That gives green blades and gold blades side by
  side, as in the mockups.
- One forward-scattering term (`pow(dot(view, sun), 8)`) handles the sun shining through the blades, mostly at their
  edges. It replaces the glow coefficients and their near/far `glowNear` split, which had flipped three times.
- Bug fixed: filtered (far, mipped) atlas texels held the data channels scaled by their coverage, so the far sward read
  as dark roots. The shader now divides the coverage back out.
- More daisy drifts, and an orange wildflower.
- 41 grey lichened rocks are scattered through the meadow (`meadowRocks` in `world/dressing.ts`). They come in small
  groups, at most 0.37 m above the grass, with no colliders, all clear of every walk (`clearOfWalks`). The boulder
  shader paints less moss and more pale lichen.
- The island lip clumps shrink away near the camera, like the meadow clumps. Before, they stood up as lime blades by
  the bridge heads.
- The ground under the nearest blades is shaded to 0.72 within 4-12 m.

## Numbers (the seats' patches, `sr/grass.py`, `sr/seatb.py`; mockup / before / after)

| patch | L p10/p50/p90 | spread | fine detail hp | mean RGB |
|---|---|---|---|---|
| A | 40/61/105 / 45/63/90 / 32/57/107 | 65 / 45 / 75 | 12.4 / 10.4 / 16.3 | 81,67,39 / 78,66,24 / 75,64,29 |
| B | 38/63/110 / 43/62/91 / 40/65/118 | 72 / 49 / 78 | 13.4 / 10.1 / 18.5 | 81,69,43 / 78,65,24 / 85,73,36 |
| D | 38/68/131 / 30/75/134 / 41/69/115 | 94 / 104 / 74 | 15.5 / 11.9 / 13.7 | 93,76,44 / 95,77,35 / 90,73,41 |
| proposal B | 33/53/96 / 38/54/77 / 37/61/108 | 63 / 39 / 72 | 10.5 / 7.7 / 16.9 | 65,60,33 / 67,57,20 / 78,67,31 |

Near-ground medians (seat B): A 61 / 63 / 57, C 67 / 78 / 76, D 56 / 85 / 59.

Hue (HSV, p25/p50/p75 in degrees) shows how varied the green is. The mockup's A patch is 37/44/49. Before it was
44/45/47, one even olive-gold. After it is 42/47/52.

GPU time (EXT_disjoint_timer_query on the M5 Max, phone-tier buffer, `sr/gputime.mjs`, meadow on, four spawn views):
the HEAD export averaged 7.21 ms p50 and the row-4 build 7.25 ms. That is within noise. It is not a phone measurement.

## What is left

- C's near patch is still bright (76 vs 67). Mockup C has a large rock there, but that spot is on the bridge apron, a
  walk, so no rock may stand there.
- Proposal B's patch is brighter than its mockup (median 61 vs 53).
- The mid-field (8-24 m) still shows the tufts as clumps over darker ground in proposal B and D. The mockups' mid-field
  is one continuous carpet.
- Blue is still short (29-41 vs 39-44).
