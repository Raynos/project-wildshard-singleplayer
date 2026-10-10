import type * as THREE from 'three';
import type { CragRows } from '../world/cragBake';
/** Select the Pine level and install its baked terrain grid (the page's ground); returns the grid's seed. */
export function installPineGround(): number;
/** The crag kit's nodes as the page loads them (src/shards/pine-hollow/generators/bake-pine-crags.mjs). */
export function pineCragKit(): Promise<Map<string, THREE.BufferGeometry>>;
/** The forest's trunks the crags step round (the physics bake's `trees`). */
export function pineTrunks(): { x: number; z: number }[];
/** The crag bake: its rows and each tier's raw (uninflated) binary. */
export function bakeCragRows(): Promise<{ rows: CragRows; bins: Record<'phone' | 'desktop', Uint8Array> }>;
