# Nalati — round 6: the ONE continuous 360° sky panorama (2026-09-23, port lead)

The painted sky at infinity for the look-v2 render path (`docs/design/nalati/handoff/port-v2.md`): sky, clouds, the
gas giant, the sun and the far ranges beyond the slab edge, as **one seamless strip** (no plates, no seams).

- `panorama-5530x1024.jpg`: the source strip. **x = compass azimuth**: x 0 = north (+z), 25% = east (−x), 50% = south,
  75% = west. 15.36 px per degree horizontally and vertically (360° × 66.7°). The mountains' base / eye-level horizon
  is at about **76% of the height (row ≈ 780)**; measure it exactly in-engine and put it in the dome shader as a
  uniform. Sky reaches about +50° above it and land about −15° below it. The sun is painted at compass 250°, about 26°
  up (the def's own sun). The planet is at about 205°, 23° up.
- `panorama-preview.jpg` is a 2400 px preview. `slices-chain.jpg` shows the seven codex slices in chain order
  (DL CL BL A BR CR CLOSE).
- `pano.py` is the generator. Slices are 1536×1024 and cover 100° each. Seed A covers 170–270°. The left chain
  (BL, CL, DL) and the right chain (BR, CR) each keep the neighbour's painted half and outpaint the grey half. The
  closing slice has both ends fixed. `stitch` feathers the overlaps. The seam check (the mean column-to-column
  difference) shows no spikes: max 7.6 against a 2.6 median, and the 0/360° wrap is 2.1.
- It is not in `public/` yet. When the dome is wired, ship it as WebP: desktop 6144 px wide, phone 4096 px (≈ 11 px/°).
