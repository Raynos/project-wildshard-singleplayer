import type { PropSceneRows } from './propSceneRows';

/** The prop scenes (src/shards/pine-hollow/generators/bake-prop-scenes.mjs): the scatter rows, the props library's geometry
 *  rows and each prop shape's GLB by product name, built once per process. */
export function pinePropScenes(): Promise<{ rows: PropSceneRows; geometry: { id: string; file: string; attributes: Record<string, never> }[]; models: [string, Uint8Array][] }>;
