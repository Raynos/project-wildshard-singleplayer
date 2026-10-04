/** Shipping rim-aware goat policy; the native spawn binds the island home and floor. */
export const GOAT_BRAIN = { id: 'far.brain.goat', kind: 'ram-grazer', strike: 'far.goat.ram',
  grazeSpeed: 1.2, ramSpeed: 7.5, noticeRadius: 9, rimMargin: 2.5, fallDrop: 1.5, levelTolerance: 2.5,
  threatSpeed: 1.6, wanderMinSeconds: 2, wanderMaxSeconds: 5, rampRate: 4 };
/** Shipping overhead circle/dive policy; each spawn supplies its existing authored orbit. */
export const RAY_BRAIN = { id: 'far.brain.ray', kind: 'orbit-diver', strike: 'far.ray.dive',
  circleSpeed: 8, hangAltitude: 9, stalkSpeed: 10, diveSpeed: 16, restSeconds: 6, noticeRadius: 40,
  giveUpRadius: 60, initialRestSeconds: 3, stalkMaxSeconds: 12, riseMargin: 2,
  targetHeight: 1.2, alignRadius: 3, alignTolerance: 1.6 };
/** Shipping wisp orbit/dart policy; the authorized native player impulse remains the contact recipe. */
export const WISP_BRAIN = { id: 'far.brain.wisp', kind: 'burst-flyer', strike: 'far.wisp.burst',
  circleSpeed: 5, dartSpeed: 13, noticeRadius: 14, shoveSpeed: 7, liftSpeed: 2.5, targetHeight: 1.2 };
