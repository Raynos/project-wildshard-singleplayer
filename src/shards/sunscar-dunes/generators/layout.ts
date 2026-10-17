/** Every coordinate in Signal Dunes, in metres. The spawn faces −Z (yaw 0), towards the tower. */
export const SEED = 5363;
export const SPAWN = { x: 0, z: 70, yaw: 0 };
/** The wooden signal tower on the far crest, 145 m ahead of the spawn. */
export const TOWER = { x: 8, z: -75, deck: 7, half: 1.8 };
/**
 * Where the dune ray lives and patrols. E409 second top-10 row 5 (mockup dusk-fire: the ray over the tower against the
 * glow): its ordinary dusk patrol circles the tower (duneRay.ts RAY.patrolR / patrolAlt), so a player at the spawn sees
 * it there; it comes for the player only within its notice range, as before.
 */
export const RAY_HOME = { x: TOWER.x, z: TOWER.z };
/** The half-buried caravan, west of the spawn: the logbook lies on its tailboard. `yaw` turns the wagon's long axis. */
export const CARAVAN = { x: -78, z: 28, yaw: 0.55 + Math.PI }; // E399 (council round 2): the tailboard faces south, so mock-B looks north at it into the afterglow
/** The dry well in the east hollow: a stone ring, a windlass the whip can pull, an oil jar in its bucket. */
export const WELL = { x: 84, z: -6 };
/** The boss basin north of the tower: a sand bowl, flat for `floor` metres, its rim at `r`. */
export const BASIN = { x: -14, z: -150, floor: 26, r: 56 };
/** Three braziers on the way to the tower: oiled by hand, lit by a whip crack. */
export const BRAZIERS: readonly { x: number; z: number }[] = [{ x: 58, z: -34 }, { x: -44, z: -22 }, { x: 34, z: -102 }];
/** The crest top the tower stands on: levelled `lift` metres over its own dune height, eased over `r`. The spawn needs
 *  none: the dunes are phased so a crest runs through it (P2), and it looks down over the rows to the tower. */
// E399 (mockups A, dusk-fire): the tower stands on a rounded dune peak, a small flat top easing out over `ease` m
// (a 40 m flat pad read as a plateau)
export const CRESTS: readonly { x: number; z: number; r: number; lift: number; ease: number }[] = []; // E407 row 1: the tower's ground is the authored mound (LANDFORMS) // council round 3: the tower crowns a big dune; round 8: a broad low mound (lift 13 over 58 m stood a tall narrow dome; both spawn mockups show a wide low rise, A a small far tower)
/**
 * Crest lines (round 9, mockup A and the seats since round 1: between the spawn and the tower the mockup shows a near
 * diagonal crest before a separate tower dune, lit on its west flank; ours fell from the spawn crest to one trough at the
 * tower dune's foot): a ridge `lift` m over the field along a segment, a gentle face `w` m wide on the windward (west)
 * side and a steeper one `lee` m wide on the east, faded over the last `fade` of its length at each end.
 */
export const CREST_LINES: readonly { a: [number, number]; b: [number, number]; lift: number; w: number; lee: number; fade: number; trough: number }[] = [
  // E407 row 1: none; the dune field itself carries the crests now (steep slip faces over long windward slopes)
  // round 26 (TOP10-3 row 2, the lead after round 24: D's land a flat 35-40 from its stand, the mockup's dark bands 12-17;
  // build them in the terrain that stand looks over, never by the camera): three low transverse ridges across D's view,
  // 15, 27 and 42 m out from its stand (38, 122), 2 m over the field, their steep lee toward the stand (turned from the
  // afterglow, so the late facing term darkens them), the gentle back toward the glow. Set 6 m east of the view line so their
  // west ends stay off the stand dune's flank (centred, they stacked on its slope to 42 deg). D's eye unchanged (27.6 m).
  // Varied (lengths 42-68 m, lifts 1.7-2.2 m, headings a few degrees apart, soft ends) so from above they read as the dune
  // field's own rows, not a ladder of three.
  { a: [21.3, 112.5], b: [70, 92.5], lift: 2, w: 15, lee: 7, fade: 0.22, trough: 0 },
  { a: [17, 101.3], b: [58.5, 81.5], lift: 1.7, w: 13, lee: 6.5, fade: 0.25, trough: 0 },
  { a: [11.5, 87.4], b: [62, 70.5], lift: 2.2, w: 16, lee: 7.5, fade: 0.22, trough: 0 },
];
/**
 * The authored landforms (E407 row 1; the lead: author the composition the mockups show as explicit landforms, judged from
 * the spawn). Absolute heights in metres, combined with the dune field by a max, so they are real terrain everywhere.
 * - `crests`: a sharp dune crest along a polyline, `h` at each point, a gentle windward profile `w` m wide on one side and
 *   a steep slip face `lee` m wide on the other (`leeSide` +1: the side to the left of a -> b, seen from above with z
 *   down; the spawn's side here), its ends rounded off over `fade` of its length.
 * - `mounds`: a broad rounded dome, `h` at its centre, falling to the field over radius `r` (a cosine profile).
 * From the spawn eye (21.1 m, pitch -12.5 deg): the crest runs from the frame's x 0.3 at y 0.40 to the right edge at y
 * 0.47 with its slip face toward the camera (mockup A's lit diagonal over a shaded face); the mound puts the tower's
 * foot on the horizon and fills dusk-fire's middle band (its big dome).
 */
export const LANDFORMS = {
  // round 17 (the lead and seat B after round 16: the 20-27 m crest stood over the 23 m eye, one shaded wall; the camera
  // must look DOWN on receding lit crests, the tower's mound showing): round 13's low crest (the closest A by eye, its
  // 7-13.5 m line mostly under the field, so the field's own receding rows show), measured inside the dune band only:
  // in-band r A +0.23 / dusk-fire +0.30 (round 16: -0.01 / -0.51), A's lit box 52 (16: 32), lit share 19-22 % (mockups
  // 15-25 %). Mounds: the tower's; a dune 150 m out along B's view, 24 m, under its glow; waymark 0's rise, 25 m (mock
  // C's far brazier burns on it, under the glow)
  // round 20 (seat B after round 19: A's lit diagonal 46 against 97, under the SHIPPED key; checked on A, dusk-fire and h1):
  // a second crest across the wind on A's diagonal, 30-50 m out and under the eye, its slip face toward the camera and
  // its key-lit back seen from above; kept short of dusk-fire's lit left shoulder (a full-length line dropped dusk-fire to
  // +0.13). Row-mean-removed r of the dune band: dusk-fire +0.42 (held), A +0.23 (from +0.13); climb 39.1 deg
  // round 21 (seat B after round 20: A's lit edge rose to the right where the mockup's FALLS from y 0.39 to 0.50): the
  // second crest turned so its west end stands highest (20.3 m falling to 10.8 m), its lit edge high on the left and low
  // on the right; edge trace x 0.1-0.5 0.41 0.40 0.40 0.42 0.42 (round 20 rose; the mockup 0.37 0.39 0.40 0.42 0.44).
  // Row-mean-removed r: A +0.61, dusk-fire +0.31; climb 39.1 deg
  // round 23 (TOP10-3 row 1: the faces the mockups light were dark, A's diagonal 46 h353 against 97 h20): under the shipped
  // key (low, ahead) a face is seen lit only as a flank turned west toward it, so the second crest is a ridge running from
  // the spawn's right toward the tower, its slip face west (leeSide -1), its lit flank seen side-on. Shaped by a per-pixel
  // predictor (each pixel's ray to the ground, the sand shader's wrap term and a shadow march toward the key, correlated
  // with A's and dusk-fire's mockups; hill-climbed under a 39 deg cap), then captured. Seat B's windows (mockup / round 22
  // / now): A's diagonal 96.5 h20 / 46.2 h353 / 86.9 h24, A's lee 42.5 / 32.6 / 47.5, dusk-fire's shoulder 83.7 / 68.0 /
  // 74.2, its saddle 49.5 / 39.6 / 30.9. Row-mean-removed r: dusk-fire +0.56, A +0.47. Climb 39.1 deg (the field's own,
  // elsewhere); walk 0 stuck (progress/physics/sd-r23-b-muspl0kj.json)
  // round 24 (seats B and C after round 23: the south end a blunt cap in front of the spawn, a dark lens in the aerials;
  // dusk-fire's right half dark, 31-34 against 50): the south end lowered and tapered into the field (to 14 m at (14, 62)).
  // Dusk-fire's saddle 31.4 -> 47.4 (49.5), its r +0.59; A's r +0.52, its diagonal 88.7 -> 78.9 (96.5). Still open: A's
  // trough (x 0.2-0.6, y 0.47-0.53) lit, the ridge's own west flank. Walk 0 stuck (progress/physics/sd-r24-b-musrfqm6.json)
  // round 25 (seats B and C after round 24: A's trough under the crest still lit, 92 against 43): a low crest (2.5 m over the
  // field) across the key's line beyond the trough, its slip face to the camera, so the trough falls in its shade and its
  // own back joins the lit band. Trough 92.4 -> 71.2, diagonal 79.8, A's r +0.52; dusk-fire's left 72.5 (71.5), its r
  // +0.49 (a taller crest shaded A's trough to 51-57 but cost dusk-fire's lit left slope, r +0.35-0.41). Walk 0 stuck
  // (progress/physics/sd-r25-b-mussawzm.json)
  crests: [{ pts: [[-42, -82, 7], [-14, -50, 13.5], [18, 20, 12]] as [number, number, number][], w: 70, lee: 30, leeSide: -1, fade: 0.3, trough: 3 }, { pts: [[-34.3, -11.8, 16.4], [-3.6, -6, 18.8], [9, 44, 18.5], [14, 62, 14]] as [number, number, number][], w: 22, lee: 40, leeSide: -1, fade: 0.1, trough: 3 }, { pts: [[-20, 39, 16.2], [-6, 34, 16.3], [8, 29, 19.7]] as [number, number, number][], w: 14, lee: 6, leeSide: 1, fade: 0.3, trough: 1 }],
  mounds: [{ x: TOWER.x, z: TOWER.z, h: 21.5, r: 62 }, { x: -165, z: -64, h: 24, r: 66 }, { x: BRAZIERS[0]?.x ?? 0, z: BRAZIERS[0]?.z ?? 0, h: 25, r: 80 }],
} as const;
/** Small flat pads (metres): the caravan's and the well's ground, eased to the dune height at their centre. */
// E399 (mockup C): each waymark on level sand too, its fire's pool flat round it
// round 8 (mockup C: the waymark stands on open ground over a low horizon; ours sat in a bowl, the dunes 11-13 deg over the
// eye from every spot round it): the west waymark (the hero brazier's, mock-C's) on a rise `lift` m over its own dune
// height, a signal seen from afar; the other two keep their ground (the east one stands in the spawn views, the south
// one's rise would reach the tower's dune)
// round 15: the caravan's pad eases over 55 m, not 101 (r * 4.6): its pull reached 123 m and levelled B's whole skyline
// into a plain (the mockup's dark dunes rise behind the wagon, 17-25 against our sky at 80)
export const PADS: readonly { x: number; z: number; r: number; lift?: number; ease?: number }[] = [{ x: CARAVAN.x, z: CARAVAN.z, r: 22, ease: 55 }, { x: WELL.x, z: WELL.z, r: 12 },
  // waymark 1 stands 10 m up its dune (mock C's composition; round 15 dropped it, round 16 back with the old wind)
  ...BRAZIERS.map((b, i) => ({ x: b.x, z: b.z, r: 6, lift: i === 1 ? 10 : 0 }))];
/** The crest paths: spawn → tower (the first, the entry trail), spawn → caravan, spawn → well, tower → basin. */
export const TRAIL: [number, number][][] = [
  [[SPAWN.x, SPAWN.z], [4, 0], [TOWER.x, TOWER.z + 6]],
  [[SPAWN.x, SPAWN.z], [-36, 52], [CARAVAN.x + 8, CARAVAN.z + 4]],
  [[SPAWN.x, SPAWN.z], [44, 40], [WELL.x - 6, WELL.z + 4]],
  [[TOWER.x - 2, TOWER.z - 6], [BASIN.x + 8, BASIN.z + BASIN.r - 6]],
];
/** Wind-cut sandstone ridges (yardangs): long low rock spines along the north wind. `len` along `yaw`, `h` tall. */
export const RIDGES: readonly { x: number; z: number; yaw: number; len: number; h: number }[] = [
  { x: -40, z: 100, yaw: 0.15, len: 22, h: 3.2 }, { x: 46, z: 92, yaw: -0.1, len: 16, h: 2.4 },
  { x: -110, z: -30, yaw: 0.25, len: 30, h: 4.2 }, { x: -96, z: -60, yaw: 0.2, len: 18, h: 2.8 },
  { x: 120, z: 50, yaw: -0.2, len: 26, h: 3.6 }, { x: 128, z: -70, yaw: 0.05, len: 34, h: 4.8 },
  { x: -70, z: -118, yaw: 0.3, len: 22, h: 3.4 }, { x: 52, z: -150, yaw: -0.25, len: 28, h: 4 },
  { x: -150, z: 120, yaw: 0.1, len: 30, h: 4.4 }, { x: 150, z: 140, yaw: -0.15, len: 24, h: 3.6 },
];
/** Where the skitterer packs burrow, and the striders' grazing grounds. */
export const PACKS: readonly { x: number; z: number; n: number }[] = [{ x: -30, z: 8, n: 3 }, { x: 60, z: 10, n: 3 }, { x: -20, z: -40, n: 4 }];
export const STRIDERS: readonly { x: number; z: number }[] = [{ x: 100, z: -50 }, { x: -100, z: 0 }];
/** The playable square and the painted ground around it. */
export const PLAY_HALF = 200;
export const GROUND_HALF = 240;
