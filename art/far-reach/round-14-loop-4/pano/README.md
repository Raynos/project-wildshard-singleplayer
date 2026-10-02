# Sky Reach, loop 4: the ONE continuous 360° painted sky (2026-10-02, sky-reach agent, E374)

The sky at infinity for `src/shards/far-reach/look/sky.ts`: sky, towering gold-rimmed cumulus, the low sun, far floating
islands with waterfalls and the cloud sea out to the horizon, as **one seamless strip** (Jake's rule: painted only at
infinity, one panorama; the method is Nalati's round 6, `art/nalati-grasslands/round-6-panorama/`).

- `panorama-5530x1024.jpg` (q92) is the source strip. **x = heading**: x 0 = the spawn's forward view (−z), 25 % = +x
  (right), 50 % = behind (+z), 75 % = −x. 15.36 px per degree both ways (360° × 66.7°). The cloud-sea horizon is row
  564 (55 % down); the sun is painted at heading 351°, 4.3° up.
- `pano.py` is the generator (codex `image_gen`, 1536×1024 slices of 100°): seed A at 300–400° (the sun centred), a left
  chain BL / CL / DL and a right chain BR / CR, each keeping its neighbour's painted half and outpainting the grey half,
  a closing slice for 90–190°, then `stitch` (feathered, each slice's own edges tapered: an untapered edge left a seam
  at 151°). `slices-chain.jpg` shows the seven slices (DL CL BL A / BR CR CLOSE).
- `prep.py 564` writes the shipped strips (`public/assets/far-reach/sky/panorama.webp` 5530 px, `.phone.webp` 4096 px,
  each with 16 columns of wrap either side) and the generated `look/panoramaData.ts` (horizon row, the painted sun,
  zenith / nadir colours, the 64-texel fog LUT the 3-D haze fades into).
- `panorama-preview.jpg` is a 2400 px preview.
