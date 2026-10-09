/**
 * The storm crown's storm (style bible §4, loop 3): a lit, swirling vortex hung over the crown, not puffs. Two stacked
 * cloud discs, each a procedural spiral (fbm noise twisted toward a dark eye, plus three log-spiral arms), dished so the
 * eye sits highest; the cloud is the cloud sea's baked 64² noise, domain-warped, its billow edges lit from the sun's side.
 * Seen from below the bellies are bruised violet; the thin edges and the sunward rim catch the low
 * sun in gold. Lightning flickers inside the eye and a jagged bolt drops now and then. The discs cost a few kilobytes of
 * vertices; the noise is one 64² texture (16 KB) and five fetches a pixel. With distance it melts into the warm haze, so
 * from the spawn it reads as a far bruise over the crown, not a lid over the sun.
 */
/**
 * `lean`: the disc tips its underside toward the arena (rad about x; the near, south rim up and the far rim down), so
 * from the entrance the spiral reads round, a funnel leaning over the crown, not squashed into streaks.
 * `gather`: the camera's distance from the storm's centre (m) over which it fades in. `ahead`: how far north of the crown
 * (-z) its eye hangs (E399, mockup D: from the arena's entrance the vortex fills the sky behind the dais, its eye about
 * 22 deg up, between the coins and the minimap above the boss bar, in the phone portrait view; centred over the crown it hung 53 deg up, out of the frame).
 */
// (round 6, seat A: 'the storm eye higher': mockup D's eye sits above the boss bar, ~29 deg up from the arena's rise; ours
// was ~18 deg) closer and higher over the crown
export const STORM = { lift: 55, ahead: 70, lean: -0.5, radius: 92, gather: [110, 170], layers: [{ dy: 0, r: 1, spin: 0.045, twist: 4.4 }, { dy: 7, r: 1.2, spin: -0.028, twist: 3.0 }] } as const;

