import type { BufferGeometry } from 'three';

export function bakeCragSceneSources(): Promise<Map<string, BufferGeometry>>;
export function cragWorldRows(shapes: ReadonlyMap<string, BufferGeometry>): unknown;
export function caveShellRows(shapes: ReadonlyMap<string, BufferGeometry>): unknown;
