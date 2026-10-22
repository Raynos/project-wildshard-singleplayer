import { readScalarChannel } from '@wildshard/engine/world/scalarChannel';
import { bakedSamplers } from '@wildshard/format/bakedTerrainSampling';
import { declaredGround,type ChunkTerrain,type RGB } from '@wildshard/game/shard/manifest';
import { mapPalette } from '@wildshard/format/minimap';
import rows from '../boot/geography.generated.json' with { type: 'json' };

/** Offline geography channels share the native terrain's clamped bilinear law. */
const values = (name: keyof typeof rows.channels): Float32Array => readScalarChannel({ type: 'f32',count: rows.res*rows.res,data: rows.channels[name] });
function channel(name: keyof typeof rows.channels): (x: number, z: number) => number {
  return bakedSamplers({ res: rows.res, size: rows.size, seed: rows.seed, landscapeHash: 0,
    heights: values(name), splat: new Uint8Array(0), undergrowth: null }).heightAt;
}
export const SEED = rows.seed;
export const SPAWN = rows.spawn;
export const wetMask = channel('wet'), forestMask = channel('forest');
const red = channel('red'), green = channel('green'), blue = channel('blue');
const gravel = channel('gravel'), rock = channel('rock'), ice = channel('ice');
/** Shared live trail SDF; every height, floor and edge read waits for the admitted native lattice. */
export const GROUND = declaredGround(rows.ground);
export const TERRAIN: ChunkTerrain = GROUND.terrain;
/** The pigment and surface masks are baked; the trail's per-pixel paint remains live. */
export function groundColor(x: number, z: number, _h: number, _slope: number, _terrain: ChunkTerrain, out: RGB): RGB {
  out[0] = red(x, z); out[1] = green(x, z); out[2] = blue(x, z); return out;
}
export function surfaceAt(x: number, z: number, _h: number, _slope: number): [number, number, number] { return [gravel(x, z), rock(x, z), ice(x, z)]; }
const mapRed = channel('mapRed'), mapGreen = channel('mapGreen'), mapBlue = channel('mapBlue');
export const NALATI_MINIMAP = { ...mapPalette(rows.map),
  ground: (x: number, z: number, _h: number, _slope: number, _forest: number, out: RGB): void => { out[0] = mapRed(x, z); out[1] = mapGreen(x, z); out[2] = mapBlue(x, z); } };
