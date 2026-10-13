import type * as THREE from 'three';
import type { CragRows } from './cragRows';
import type { CragGround } from './cragGround';
/** Explicit original renderer lattice and authored exclusion queries; no level is selected. */
export function pineCragGround(): CragGround;
/** The crag kit's nodes as the page loads them (src/shards/pine-hollow/generators/bake-pine-crags.mjs). */
export function pineCragKit(): Promise<Map<string, THREE.BufferGeometry>>;
/** The forest's trunks the crags step round (the physics bake's `trees`). */
export function pineTrunks(): { x: number; z: number }[];
/** The crag bake: its rows and each tier's raw (uninflated) binary. */
export function bakeCragRows(): Promise<{ rows: CragRows; bins: Record<'phone' | 'desktop', Uint8Array> }>;
