import { BASIN } from './layout';

/** The Matriarch's complete authored fresh-body boss policy; both native hosts admit this same row. */
export const MATRIARCH_BOSS_PROFILE = { kind: 'boss', pattern: 'spawned', fight: {
  arena: { x: BASIN.x, z: BASIN.z, r: BASIN.r + 34 }, hpShares: [1, 0.66, 0.33], riseSeconds: 3.2,
  stormPhases: [1], stormFade: 2.5, fields: { fight: 'fight', rise: 'rise', phase: 'phase' },
} } as const;
