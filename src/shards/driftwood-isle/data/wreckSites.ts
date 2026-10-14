import { WORLD_DROP } from './landscapeRows';
/** The two authored shipwreck sites: Wreck Cove and the Explorer's flat-ground specimen. */
export const WRECK_SITES = {
  world: { x: 153, z: 2, heading: 2.7, roll: -0.2, pitch: 0.05, floorY: 1.45 - WORLD_DROP },
  specimen: { x: 0, z: 0, heading: 0, roll: -0.2, pitch: 0.05, floorY: 1.2 },
} as const;
