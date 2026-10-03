# Check pass — seat B (evidence and coverage), Signal Dunes only

This pass checks only the ten open rows (COUNCIL.md's check-pass rule). It admits no new findings. A defect that a row's own
fix introduced counts against that row, as round 2 did with R1C-5's saw-tooth.

Paths: `CP/` = `progress/sunscar-dunes/20261002-0207-1a8fe8c8/` (the check-pass capture, 780×1688 frames, clip 540×1168
@30). `R2/` = `progress/sunscar-dunes/20261002-0136-14a26e19/`. `REF/<slug>/` = `progress/<slug>/20261002-0011-0d59505c/`.
I checked each row frame by frame at full resolution, with crops, clip frames extracted with ffmpeg (1 fps, plus every
frame from 8.5 s to the end), and CIELAB L*/hue measurements over the world band (y 600–1430). The builder's claims come
from `art/sunscar-dunes/round-15-check-pass/README.md` and commits `0e6d9c54`, `1c9c07ff` and `a508740a`.

| ID | Status | Evidence frame | Note |
|---|---|---|---|
| R1A-2 | partly | `CP/first-frame.jpg`, `CP/h3-waymark.jpg`, `CP/h4-tower-deck.jpg` (x 460–780, y 860–1420) vs the same crop in `R2/`; `REF/nine-dragon-stack/first-frame.jpg` | The claim holds for the facets: averaging the glove's colours per vertex (`a508740a`) removed every triangle patch. But the same averaging also erased the seams and knuckle edges that the fix asked to keep. The glove now reads as one smooth clay or rubber mitt, about 300×500 px, with no stitching or wear. The coil is still three nested pale hoops plus a dark loop under the fist, not a cord hanging with weight from a visible attachment. On `compare-first-frame.jpg` it is still the plainest viewmodel of the six, but it no longer looks broken. |
| R1A-5 | partly (was not fixed) | `CP/h2-caravan.jpg` (x 260–500, y 580–820) vs `R2/` (my 2× crop) | The claim holds for the cover. A pale canvas runs the length of the wagon and now separates from the timber. Wagon mean luma rose from 49 to 58, and p5 from 4 to 16. The rest of the fix did not land. The body, wheels, tongue and hoops are still one flat maroon with no plank, grain or iron separation. The cover is a few large flat slabs, and the torn front piece reads as a tilted card. It is still below `REF/driftwood-isle/h2-hut.jpg`. H2's world-band L* standard deviation is 10.9, the lowest of the 20 hero frames across five shards. |
| R1B-14 | **regressed** | `CP/clip.mp4` 8.6–10.0 s (sky, x ≈ 20→200 of 540, y 0–150); `CP/aerial-spawn.jpg` y 0–110; `CP/aerial-overview.jpg` y 0–110; `R2/clip.mp4` 9.6 s for before | The fix landed in part. The far ranges now break the horizon in both aerials and the clip. A violet low cloud bank fills the clip's sky, and the aerial-spawn has high violet streaks. The overview's sky above the ranges is still flat orange, and its places are still lantern dots plus a tower about 20 px tall. The new cloud bank (`a508740a`, `look/sky.ts` `bankN = vNoise(vec2(az * 5.0, …))` with `az = atan(d.z, d.x)`) has a **hard vertical seam** where atan wraps. It shows as a straight vertical cut through the violet cloud mass, with a horizontal step at its foot, in about 40 consecutive clip frames. It is absent from the same orbit in `R2/clip.mp4`. A player turning 360° sees it. The milky wash at 9.5 s is weaker than in R2 but still present. |
| R1B-16 | verified | `art/sunscar-dunes/round-14-council-r1/whip-arena.jpg`, row 2 (re-shot in `1c9c07ff`) | The board now covers idle, light, heavy and the pull: frame 1 shows the lash reaching the well's crank post. Coverage, which is what this row asked for, is complete. Two caveats: the pull reads weakly (the bucket is not visible at phone size, and the post is near-black), and the board predates `a508740a`, so it shows the glove before the colour averaging. |
| R1B-20 | partly | `docs/plans/SKY-REACH.md` rows C1–C7 and P1–P8; `docs/plans/SIGNAL-DUNES.md` line 3 and P7 | Sky Reach's rows are now `done` with evidence (`0413842a`). C4's title still reads "Raise the fallen bridge to the windmill island" (its done cell now names the crown winch). Signal Dunes' State line still says "round 2, the last, waits on the lead", and its P7 row says "round 2 next", although round 2 ran. This is a nit and does not decide the verdict. |
| R1C-1 | verified | `CP/h3-waymark.jpg`, `CP/h4-tower-deck.jpg` vs `R2/` | H3 is now composed on its subject: a two-tier plinth, fieldstones, a kindling teepee in the bowl and a banner, with the signal tower beyond. Its L* standard deviation rose from 8.9 to 16.5, so it is no longer the flattest frame. H4 keeps the brazier, rail and deck in the foreground and the basin beyond, and its prompt fires with the object in frame. One claim is not visible: the hanging lantern on the banner pole is hidden behind the glove, and only its light pool shows (x 500–540, y 1230–1290). How dark these objects are belongs to R1C-2. |
| R1C-2 | partly | `CP/h3-waymark.jpg` (post x 372–392, y 1080–1230; bowl y 1020–1045), `CP/h4-tower-deck.jpg` (post, bowl, rail), `CP/h2-caravan.jpg` | The props were lifted, but not enough. H4's rail went from L* 0.8 to 6.4 and its post from 0.5 to 1.4. H4's pedestal and kindling are now tan. The wagon is lighter (see R1A-5). But the H3 waymark's post (L* 1.9) and bowl (2.3), and H4's bowl (2.7), are still black silhouettes against sand at L* 31. I see no rim on them at full resolution, and the H3 banner is near-black maroon (L* 9). The style bible bans black silhouettes. The README's "a stronger cool floor and rim on every prop" does not show on the braziers. The creature half of this row was verified in round 2 and was not rechecked. |
| R1C-3 | verified | `CP/first-frame.jpg`, `CP/h1-spawn-crest.jpg` (ground hue 319°, about 70 % violet); `CP/h2`–`h4` (blue-violet zenith, slate cloud tops, lavender ranges) | The README's claim holds for every view: blue or violet is now in each eye-level frame. In H2–H4 it is in the sky and on the ranges, while the near ground stays orange (hue 33–39°). That is consistent with lit slopes. The warm/cool crest split remains the strongest edge in the first frame. |
| R1C-4 | verified | `CP/first-frame.jpg`, `CP/h2-caravan.jpg` (glove crop as in R1A-2) | All three things this row asked for are present: the handle angles toward the crosshair, the coil sits under the fist, out of the centre third, and the glove's facets no longer read as a decimated scan. Against violet shade the glove is a clear step lighter. Against lit orange sand (H3) it separates by hue more than by value. What is still missing (seams, coil weight) is R1A-2's. |
| R1C-5 | partly | `CP/aerial-overview.jpg` y 140–420 vs `R2/` (side-by-side and level-stretched crops); `CP/aerial-spawn.jpg` x 380–480, y 400–880 | Two parts are verified. The saw-tooth skirt is gone: the skirt is a smooth continuous slope, so round 2's regression is fixed. The ruler-straight lavender top is replaced by a ragged range with peaks. Two parts are not fixed. Trails still don't read from above: the "pale baked 0.75 m path" is not visible at 780 px, and the only line is the same straight, translucent, hard-edged strip running from the tower toward the camera, which reads as a shading band and not a path. The overview's crests are still rounded swells. Of the six aerials on `compare-aerial-overview.jpg`, it is still the only one where no place or route reads. |

**Tally:** 4 verified (R1B-16, R1C-1, R1C-3, R1C-4) · 5 partly (R1A-2, R1A-5, R1B-20, R1C-2, R1C-5) · 0 not fixed ·
1 regressed (R1B-14, the cloud bank's atan seam).

**Why below.** The check pass closed real gaps:
- H3 and H4 have subjects;
- the saw-tooth skirt is gone;
- the wagon has a cover;
- the glove no longer shows facets;
- the hero-frame darkness (mean L* 23–35) now sits inside Pine Hollow's and Nine Dragon's range.

What is still open is still visible to Jake when he plays it right after the other four:
- the quest's own objects, the waymark and deck braziers, are black (L* about 2) on lit sand, next to the other shards'
  built lookouts in `compare-h3.jpg`;
- the wagon is flat maroon slabs next to Driftwood's hut;
- the overview still shows no place or route;
- the cloud bank added for R1B-14 has a hard seam in the sky that he will see when he turns.

It is closer than in round 2, but not at their level.

VERDICT signal-dunes: below the bar
