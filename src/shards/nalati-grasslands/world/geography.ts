import { readScalarLattice } from '@wildshard/engine/world/scalarChannel';
import { declaredGround,declaredGroundColour,declaredSurface,declaredMapColour,type ChunkTerrain } from '@wildshard/game/shard/manifest';
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
export const NALATI_MINIMAP = { ...mapPalette(rows.map),ground: declaredMapColour([rows.channels.mapRed,rows.channels.mapGreen,rows.channels.mapBlue]) };
