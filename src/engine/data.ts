/** Node-safe public API for authored manifests and offline asset tools. */
export { CHUNK_HALF } from './core/config';
export { smoothstep, clamp, lerp } from './core/noise';
export { buildTerrain } from './world/terrainField';
export { terrainFieldFor } from './world/groundField';
export { layoutFauna } from './world/faunaLayout';
export type { SpeciesWeights, TreeSpeciesTraits, TreeSetVariant } from './world/forest/treeSpecies';
export { filePolicy, PUBLIC_BYTES } from './boot/filePolicy';
export type { ChunkFiles } from './boot/bytes';
export type { Tier } from './core/tier';
export type { TexMode } from './boot/gpuFiles';
export type { TerrainNoise, Vec2 } from './level/data';
export { CELL, type BlenderArea } from './world/blenderArea';
export { swellBody, basinBody, type WaterBody } from './world/water/body';
export { surfaceReflect, type WaterView } from './world/water/view';
