import type { PropRows } from '../src/shards/pine-hollow/world/props';
/** The forest's trunks the props step round (the physics bake's `trees`: x, z, r). */
export function pineTrunkCircles(): { x: number; z: number; r: number }[];
/** The props bake's rows (scripts/bake-pine-props.mjs). */
export function bakePropRows(): Promise<PropRows>;
