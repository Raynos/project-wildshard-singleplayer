import type { WakeRibbonRow } from '@wildshard/sdk/looks/wakeRibbon';

/**
 * A drift ray's luminous wake (E399 round 10, seat A, proposal B: 'the ray's ordinary curling luminous wake beside the
 * mill'; drawn by @wildshard/sdk/looks/wakeRibbon): 56 samples a fifteenth of a second apart, 1.6 m wide behind the ray,
 * a pale cyan glow.
 */
export const RAY_WAKE: WakeRibbonRow = { samples: 56, every: 0.07, width: 1.6, color: [0.62, 0.92, 1.0], name: 'far.ray-wake' };
