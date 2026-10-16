
/**
 * A drift ray's luminous wake (E399 round 10, seat A, proposal B: 'the ray's ordinary curling luminous wake beside the
 * mill'; drawn by @wildshard/sdk/looks/wakeRibbon): 56 samples a fifteenth of a second apart, 1.6 m wide behind the ray,
 * a pale cyan glow.
 */
export const RAY_WAKE: WakeRibbonRow = { samples: 56, every: 0.07, width: 1.6, color: [0.62, 0.92, 1.0], name: 'far.ray-wake' };

/** A wake's row: how many samples, seconds between them, its width at the head (m), its colour (linear RGB) and mesh name. */
export interface WakeRibbonRow {
  readonly samples: number;
  readonly every: number;
  readonly width: number;
  readonly color: readonly [number, number, number];
  readonly name: string;
}
