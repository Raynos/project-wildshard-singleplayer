import * as LAYOUT from '../layout';

/** The Matriarch's complete authored fresh-body boss policy; both native hosts admit this same row. */
export const MATRIARCH_BOSS_PROFILE: { readonly kind: "boss"; readonly pattern: "spawned"; readonly fight: { readonly arena: { readonly x: number; readonly z: number; readonly r: number; }; readonly hpShares: readonly [1, 0.66, 0.33]; readonly riseSeconds: 3.2; readonly stormPhases: readonly [1]; readonly stormFade: 2.5; readonly fields: { readonly fight: "fight"; readonly rise: "rise"; readonly phase: "phase"; }; }; } = { kind: 'boss', pattern: 'spawned', fight: {
  arena: { x: LAYOUT.BASIN.x, z: LAYOUT.BASIN.z, r: LAYOUT.BASIN.r + 34 }, hpShares: [1, 0.66, 0.33], riseSeconds: 3.2,
  stormPhases: [1], stormFade: 2.5, fields: { fight: 'fight', rise: 'rise', phase: 'phase' },
} } as const;
