
/**
 * A drift ray's luminous wake (E399 round 10, seat A, proposal B: 'the ray's ordinary curling luminous wake beside the
 * mill'; drawn by @wildshard/sdk/looks/wakeRibbon): 56 samples a fifteenth of a second apart, 1.6 m wide behind the ray,
 * a pale cyan glow.
 */
export const RAY_WAKE: WakeRibbonRow = { samples: 56, every: 0.07, width: 1.6, color: [0.62, 0.92, 1.0], name: 'far.ray-wake' };

/**
 * The wake's glow (an SF59 graph, the shardfile's `look.materials.ray-wake`): brightest at the head (`aFade` 1 → 0 along
 * it) and down its middle (`aSide` ±1 at its edges), additive, unfogged, no depth write.
 */
export const RAY_WAKE_GRAPH = { version: 1, kind: 'material', model: 'unlit', doubleSided: true, effectState: { blend: 'additive', fog: false, depthWrite: false, singlePass: true },
  nodes: { f: { op: 'attribute', name: 'aFade', type: 'float' }, s: { op: 'attribute', name: 'aSide', type: 'float' }, ff: { op: 'mul', in: ['f', 'f'] }, ss: { op: 'mul', in: ['s', 's'] },
    edge: { op: 'mul', in: ['ss', 0.85] }, mid: { op: 'oneMinus', in: ['edge'] }, fm: { op: 'mul', in: ['ff', 'mid'] }, a: { op: 'mul', in: ['fm', 0.9] }, colour: { op: 'mul', in: ['a', RAY_WAKE.color] } },
  stages: { surface: { colour: 'colour', alpha: 'a' } } } as const;

/** A wake's row: how many samples, seconds between them, its width at the head (m), its colour (linear RGB) and mesh name. */
export interface WakeRibbonRow {
  readonly samples: number;
  readonly every: number;
  readonly width: number;
  readonly color: readonly [number, number, number];
  readonly name: string;
}
