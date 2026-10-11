/** Existing beach boar variants, in the original placement draw order. */
export const ISLAND_BOARS = ['boar', 'sow', 'black', 'big'];

/** manifest.ts `faunaTuning` (the beach boars' long sight lines); test/shards/driftwood-isle/headless-runtime.test.ts holds
 *  it equal to DRIFTWOOD_ISLE.faunaTuning. */
export const DRIFTWOOD_FAUNA_TUNING = {
  boar: { sightRange: 42, sightRangeGraze: 26, sightCone: 1.22, hearWalk: 18, hearSprint: 34, noticeRate: 0.65, impactAlert: 28 },
};

interface FaunaPlan { kind: string; count: number; variants?: string[]; anchor?: { x: number; z: number; rMin: number; rMax: number }; canopy: boolean; trailBand: [number, number] }

/** The five legacy anchor searches remain in AnimalManager, with unchanged order and variant draws. */
export const DRIFTWOOD_FAUNA_PLANS: FaunaPlan[] = [
  { kind: 'boar', count: 4, variants: ISLAND_BOARS, anchor: { x: 66, z: -132, rMin: 5, rMax: 20 }, canopy: false, trailBand: [8, 600] },
  { kind: 'boar', count: 3, variants: ISLAND_BOARS, anchor: { x: -140, z: -30, rMin: 5, rMax: 30 }, canopy: false, trailBand: [8, 600] },
  { kind: 'boar', count: 4, variants: ISLAND_BOARS, anchor: { x: 30, z: 150, rMin: 5, rMax: 30 }, canopy: false, trailBand: [8, 600] },
  { kind: 'bear', count: 1, variants: ['brown'], anchor: { x: 56, z: -84, rMin: 4, rMax: 16 }, canopy: false, trailBand: [8, 600] },
  { kind: 'bear', count: 1, variants: ['black', 'black-blaze'], anchor: { x: -122, z: -100, rMin: 4, rMax: 14 }, canopy: false, trailBand: [8, 600] },
];
