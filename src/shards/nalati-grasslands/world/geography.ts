import { readScalarLattice } from '@wildshard/engine/world/scalarChannel';
import { declaredGround,declaredGroundColour,declaredSurface,type ChunkTerrain,type RGB } from '@wildshard/game/shard/manifest';
import { mapPalette } from '@wildshard/format/minimap';
import rows from '../boot/geography.generated.json' with { type: 'json' };

export const SEED = rows.seed;
export const SPAWN = rows.spawn;
export const wetMask = readScalarLattice(rows.channels.wet), forestMask = readScalarLattice(rows.channels.forest);
export const groundColor = declaredGroundColour(rows.pigment);
export const surfaceAt = declaredSurface(rows.surface);
/** Shared live trail SDF; every height, floor and edge read waits for the admitted native lattice. */
export const GROUND = declaredGround(rows.ground);
export const TERRAIN: ChunkTerrain = GROUND.terrain;
const mapRed = readScalarLattice(rows.channels.mapRed), mapGreen = readScalarLattice(rows.channels.mapGreen), mapBlue = readScalarLattice(rows.channels.mapBlue);
export const NALATI_MINIMAP = { ...mapPalette(rows.map),
  ground: (x: number, z: number, _h: number, _slope: number, _forest: number, out: RGB): void => { out[0] = mapRed(x, z); out[1] = mapGreen(x, z); out[2] = mapBlue(x, z); } };
