# Sky Reach: the Roc's face and its perch turn (E410 rows 1 and 5)

Mockup D shows the eagle's white head in profile with a hooked gold beak and gold talons. From D's camera ours showed
only its white breast: it perched turned a fixed 0.8 rad from the arena's entrance (picked against D's camera) and swung
round head-on to the player, so the head sat behind the breast; and its gold beak and toes were turned slate.

- **The perch faces into the storm's wind** (`perchYaw` in `src/shards/far-reach/species/stormRoc.ts`). A perched raptor
  faces into the wind and lifts off into it. The storm's painted vortex turns counter-clockwise seen from above
  (`STORM.layers[0].spin > 0`), so its winds circle the eye that way; on the crown, south of the eye, they blow east, and
  the Roc on the tallest stone faces west: side-on to the entrance (-pi/2 from it; was -0.8). The heading is computed
  from the storm's eye and spin, not from any camera.
- **The take-off climbs to its lap height** (`ROC_TAKEOFF.rise` 2 m is gone): lifting into the wind it climbs from the
  perch (49.6 m) to the lap's altitude (`ROC.y`, 55 m) over the 4 s take-off, so the lap begins level. With the fixed
  2 m it hung at the sun's height and, side-on, its talons covered the sun from the arena (sun patch 14.6 %).
- **The gold keeps** (the Roc's slate plumage patch, `plugin.ts`): in linear light the beak and toes' gold (g/r ~0.47)
  passed the patch's brown test and turned slate, though the patch says they stay. Blue under a tenth of red, bright,
  now keeps its colour; in the 1024 map only the beak and toe islands match (15 264 texels).
- No new model, no texture change: GPU memory unchanged.

## Files

- `board-d.jpg`: A mockup D · B round 14 (`progress/far-reach/20261003-0823-ce11353e`) · C new, the same camera and
  stage (`roc-opening`, 3.3 s) · D C cropped at the capture's 3x: the white head in profile, the gold beak, gold talons.
- `views.jpg`: the new Roc elsewhere: the fight's lap (`roc-lap`, 1.5 s), the stalk from below (`roc-stalk`), the
  take-off seen from the west, h4-crown, aerial-overview. No tears.

## Measured (mock-D, Rec. 709, 390 x 844 BICUBIC)

| | mockup D | round 14 | new |
| --- | ---: | ---: | ---: |
| sun patch x .05-.45 / y .44-.50, share > 230 | 36.7 % | 20.2 % | **24.7 %** |
| sun disc, left half y .40-.52, share > 245 | 6.25 % | 2.44 % | **3.24 %** |
| frame p99 (rows 60-699) | 241.4 | 231.4 | **233.1** |
| mean of the top 1 % | 247.6 | 240.5 | **242.0** |

Both wingtips are in the frame (x ~.05 and ~.65); the head sits at y ~.31, under the bar (y .25).

## Open

- Side-on, the eagle spans ~.6 of the frame where D's spans ~.95 (it flies three-quarter on in D, its head turned in
  profile); its upper wing passes behind the boss bar. A larger head turn on the head bone (clamped at 0.6 rad) would
  let a three-quarter body show a profile head, but from the front the head sits behind the breast (the round-14 finding).
