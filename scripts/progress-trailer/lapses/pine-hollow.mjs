// The Pine Hollow remaster (PROGRESS-TRAILER §2.2 0:22–0:28, row PT5): §2.2's fallback for the Nine Dragon lapse, whose
// stages do not read as growth (lapses/nine-dragon.mjs). From main's day 8 (2d2c5815a: the low-poly pines under
// faceted grey peaks) through the PINE-HOLLOW-REMASTER plan's 24–25 Sep rows to its finish (1b60e0435): the world re-laid,
// the landmarks, the Blender species set, the granite ridge, the look loop; it ends on main's day 15 (19a434635), the
// chapter SHA its band names. One slow drift from the south-east over the
// spawn trail toward the Ridge (2.7 m/s, no orbit).
export const lapse = {
  name: 'pine-hollow',
  title: 'Pine Hollow remaster · lapse stages',
  seconds: 6,
  query: 'chunk=pine-hollow&nolock=1&skipintro=1&mute=1',
  fov: 50,
  warmSec: 20,
  path: [
    { t: 0, cam: [124, 92, -264], at: [0, 10, -60] },
    { t: 6, cam: [112, 88, -254], at: [-4, 10, -56] },
  ],
  sheetT: 3,
  stages: [
    { sha: '2d2c5815a', t0: 0, t1: 1 }, // 23 Sep 20:40 main's day 8: the old Pine Hollow
    { sha: '870e70784', t0: 1, t1: 2 }, // 24 Sep 08:27 PH layout v2: the world re-laid (the Ridge north, the Den, the old growth)
    { sha: '6883d1835', t0: 2, t1: 3 }, // 24 Sep 19:32 PH-B4: the Blender-built photoreal species set, the photographic sky
    { sha: 'c39338092', t0: 3, t1: 4.5 }, // 24 Sep 21:46 PH-L1/L4/L8: the look loop, the granite ridge, the boreal ground
    { sha: '1b60e0435', t0: 4.5, t1: 5.25 }, // 25 Sep 06:29 PINE-HOLLOW-REMASTER finished
    { sha: '19a434635', t0: 5.25, t1: 6 }, // 30 Sep 23:57 main's day 15, the week-2 chapter SHA: the band's "WEEK 2 · 2,495" is this picture's count
    // dropped: 5901c5507 (24 Sep 11:32, the landmarks) opens on the def's blue dusk and reads darker than 870e70784;
    // bee0c6b9e (25 Sep 01:19, look loop round 3) is 1b60e0435's picture from here
  ],
};
