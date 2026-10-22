import { readScalarLattice } from '@wildshard/engine/world/scalarChannel';
import { declaredGround,type ChunkTerrain,type RGB } from '@wildshard/game/shard/manifest';
import { mapPalette } from '@wildshard/format/minimap';
import rows from '../boot/geography.generated.json' with { type: 'json' };

export const SEED = rows.seed;
export const SPAWN = rows.spawn;
export const wetMask = readScalarLattice(rows.channels.wet), forestMask = readScalarLattice(rows.channels.forest);
const red = readScalarLattice(rows.channels.red), green = readScalarLattice(rows.channels.green), blue = readScalarLattice(rows.channels.blue);
const gravel = readScalarLattice(rows.channels.gravel), rock = readScalarLattice(rows.channels.rock), ice = readScalarLattice(rows.channels.ice);
/** Shared live trail SDF; every height, floor and edge read waits for the admitted native lattice. */
export const GROUND = declaredGround(rows.ground);
export const TERRAIN: ChunkTerrain = GROUND.terrain;
/** The pigment and surface masks are baked; the trail's per-pixel paint remains live. */
export function groundColor(x: number, z: number, _h: number, _slope: number, _terrain: ChunkTerrain, out: RGB): RGB {
  out[0] = red(x, z); out[1] = green(x, z); out[2] = blue(x, z); return out;
}
export function surfaceAt(x: number, z: number, _h: number, _slope: number): [number, number, number] { return [gravel(x, z), rock(x, z), ice(x, z)]; }
const mapRed = readScalarLattice(rows.channels.mapRed), mapGreen = readScalarLattice(rows.channels.mapGreen), mapBlue = readScalarLattice(rows.channels.mapBlue);
export const NALATI_MINIMAP = { ...mapPalette(rows.map),
  ground: (x: number, z: number, _h: number, _slope: number, _forest: number, out: RGB): void => { out[0] = mapRed(x, z); out[1] = mapGreen(x, z); out[2] = mapBlue(x, z); } };
