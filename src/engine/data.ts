/** Node-safe public API for authored manifests and offline asset tools. */
export { CHUNK_HALF } from './core/config';
export { smoothstep, clamp, lerp } from './core/noise';
export { buildTerrain } from './world/terrainField';
export { layoutFauna } from './world/faunaLayout';
export { TREE_SPECIES, type SpeciesWeights } from './world/forest/treeSpecies';
export { filePolicy, PUBLIC_BYTES } from './boot/filePolicy';
export type { ChunkFiles } from './boot/bytes';
export type { Tier } from './core/tier';
export type { TexMode } from './boot/gpuFiles';
export type { TerrainNoise, Vec2 } from './level/data';
