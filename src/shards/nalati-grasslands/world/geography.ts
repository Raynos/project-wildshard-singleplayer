import { unzlibSync } from 'fflate';
import { bakedSamplers } from '@wildshard/format/bakedTerrainSampling';
import { createBakedTerrainField } from '@wildshard/engine/world/bakedTerrainField';
import { mapPalette } from '@wildshard/format/minimap';
import type { ChunkTerrain, RGB } from '@wildshard/game/shard/manifest';
import rows from '../boot/geography.generated.json' with { type: 'json' };
import layout from '../boot/layout.generated.json' with { type: 'json' };

/** Offline geography channels share the native terrain's clamped bilinear law. */
function values(name: keyof typeof rows.channels): Float32Array {
  const bytes = unzlibSync(Uint8Array.from(atob(rows.channels[name]), value => value.codePointAt(0) ?? 0));
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}
function channel(name: keyof typeof rows.channels): (x: number, z: number) => number {
  return bakedSamplers({ res: rows.res, size: rows.size, seed: rows.seed, landscapeHash: 0,
    heights: values(name), splat: new Uint8Array(0), undergrowth: null }).heightAt;
}
export const SEED = rows.seed;
export const SPAWN = rows.spawn;
export const wetMask = channel('wet'), forestMask = channel('forest');
const valley = channel('valley'), bowl = channel('bowl'), snow = channel('snow');
const red = channel('red'), green = channel('green'), blue = channel('blue');
const gravel = channel('gravel'), rock = channel('rock'), ice = channel('ice');
/** Shared live trail SDF; every height, floor and edge read waits for the admitted native lattice. */
export const TERRAIN: ChunkTerrain = createBakedTerrainField({ key: 'nalati-grasslands', seed: SEED }, {
  water: rows.river.level, cabinSites: [], trails: [layout.S_ROAD_PTS, layout.N_ROAD_PTS, layout.E_ROAD_PTS, layout.W_ROAD_PTS,
    layout.SKY_ROAD, layout.CAMP_SPUR, ...layout.BOWL_TRACKS, layout.EAGLE_TRAIL, layout.CAVE_TRAIL, layout.ARGYMAQ_TRAIL],
  mask: { res: rows.res, size: rows.size, values: values('pond') },
});
export function zoneAt(x: number, z: number): [number, number, number] { return [valley(x, z), bowl(x, z), snow(x, z)]; }
/** The pigment and surface masks are baked; the trail's per-pixel paint remains live. */
export function groundColor(x: number, z: number, _h: number, _slope: number, _terrain: ChunkTerrain, out: RGB): RGB {
  out[0] = red(x, z); out[1] = green(x, z); out[2] = blue(x, z); return out;
}
export function surfaceAt(x: number, z: number, _h: number, _slope: number): [number, number, number] { return [gravel(x, z), rock(x, z), ice(x, z)]; }
const mapRed = channel('mapRed'), mapGreen = channel('mapGreen'), mapBlue = channel('mapBlue');
export const NALATI_MINIMAP = { ...mapPalette(rows.map),
  ground: (x: number, z: number, _h: number, _slope: number, _forest: number, out: RGB): void => { out[0] = mapRed(x, z); out[1] = mapGreen(x, z); out[2] = mapBlue(x, z); } };
