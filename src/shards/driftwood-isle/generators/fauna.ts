import manifest from '../manifest.json' with { type: 'json' };

/** Author ranges shared by the offline enemy compiler and registered spawn catalogue. */
export const ENEMY_COUNTS = { tidepool: [3, 5] as const, grove: [3, 4] as const };

/** manifest.ts `faunaTuning` (the beach boars' long sight lines); test/shards/driftwood-isle/headless-runtime.test.ts holds
 *  it equal to DRIFTWOOD_ISLE.faunaTuning. */
export const DRIFTWOOD_FAUNA_TUNING = {
  boar: { sightRange: 42, sightRangeGraze: 26, sightCone: 1.22, hearWalk: 18, hearSprint: 34, noticeRate: 0.65, impactAlert: 28 },
};

/** The five original anchor searches share the manifest's admitted data order. */
export const DRIFTWOOD_FAUNA_PLANS: { kind: string; count: number; variants: string[]; anchor: { x: number; z: number; rMin: number; rMax: number; }; canopy: boolean; trailBand: number[]; }[] = manifest.spawns;

/** Historical fauna continuation fields; future fields remain on their existing native defaults. */
export const DRIFTWOOD_HUNT_MEMORY_FIELDS=['timer','tx','tz','fleeT','fleeUntil','chargeCd','callT','awareness','freeze',
  'spooked','wary','sensed','windup','backoff','side','committed','path','pathI','goalX','goalZ','repathAt'] as const;
