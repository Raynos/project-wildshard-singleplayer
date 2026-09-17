// Chunk spec from sources/wildshard/FUNDAMENTALS.md
export const CHUNK_SIZE = 500;        // metres, square
export const CHUNK_HALF = CHUNK_SIZE / 2;
export const CHUNK_DEPTH = 100;       // metres of rock under the surface (the floating slab)
export const ROAD_WIDTH = 15;         // entry road at each edge midpoint
export const ROAD_LENGTH = 60;        // must be >= 50m into the chunk
export const CHUNK_ID = 'chunk://local/pine-hollow';
export const CHUNK_COORDS = '(+3, −2)';

export const TERRAIN_RES = 256;       // vertices per side
export const TREE_COUNT = 2600;
export const GRASS_RADIUS = 60;
export const SEED = 1337;
