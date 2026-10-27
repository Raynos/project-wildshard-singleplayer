import { Rng } from '@wildshard/sdk/random';
import { encodePortableBytes } from '@wildshard/sdk/bake/portableBytes';
import type { GeographyRows } from '../data/geographyTypes';
import sourceRows from '../data/geographySources.json' with { type: 'json' };
import meadow from '../data/grassFieldLayout.json' with { type: 'json' };
import { SEED, TERRAIN, RIVER, SPAWN, groundColor, surfaceAt, riverMask, brookMask, loneSpruceMask, inSpruceClearing, edgeBermAt } from './terrainRecipe';
import { edgeSpruceMask } from './edgeRecipe';
import { nalatiWetAt } from './wetRecipe';
import { NALATI_MINIMAP } from './minimapRecipe';

const res = 256, size = 500;
const forestMask = (x: number, z: number): number => inSpruceClearing(x, z) ? 0 : Math.max(loneSpruceMask(x, z), edgeSpruceMask(x, z, edgeBermAt(x, z)));
const lattice = (key: string): GeographyRows['pigment'][number] => ({ res, size,
  values: { type: 'f32', count: res * res, data: { file: `data/geography-${key}.bin` } } });

/** Fresh metadata uses the original RNG continuation, stipple order and scalar locators.
 * Scalar rasters are constructed separately, so header consumers never bake them. */
export function nalatiGeographyRows(): GeographyRows {
  const rng = new Rng(SEED + 4242), marks: GeographyRows['map']['marks'][number][] = [];
  for (let x = -247; x < 247; x += 4.2) for (let z = -247; z < 247; z += 4.2) {
    const cx = x + rng.range(-1.6, 1.6), cz = z + rng.range(-1.6, 1.6);
    if (rng.next() > forestMask(cx, cz) * 0.85) continue;
    const r = 1.6 + rng.range(0, 1.1), fill = rng.next() < .5 ? '#2c4a30' : '#38583a';
    marks.push({ kind: 'dot', x: cx + .8, z: cz + .8, r, fill: 'rgba(14, 26, 18, 0.45)' }, { kind: 'dot', x: cx, z: cz, r, fill });
  }
  const pois = NALATI_MINIMAP.pois;
  if (pois === undefined) throw new Error('Missing native geography POI recipe');
  return { sources: sourceRows.map(row => ({ name: row.name, kind: 'bin', source: row.source, options: { decoded: row.options.decoded } })),
    res, size, seed: SEED, spawn: { ...SPAWN }, river: { level: RIVER.level },
    channels: { wet: lattice('wet'), forest: lattice('forest'), mapRed: lattice('mapRed'), mapGreen: lattice('mapGreen'), mapBlue: lattice('mapBlue') },
    pigment: [lattice('red'), lattice('green'), lattice('blue')], surface: [lattice('gravel'), lattice('rock'), lattice('ice')],
    ground: { terrain: { key: 'nalati-grasslands', seed: SEED }, trails: structuredClone(TERRAIN.trails), cabinSites: [], water: RIVER.level,
      mask: lattice('pond'), bodies: [{ id: 'river', kind: 'terrain-basin' }], paths: 'plugin' },
    map: { ground: { base: [92, 128, 58], layers: [] }, segments: [],
      trails: [{ width: 6, style: 'rgba(70, 54, 36, 0.8)' }, { width: 3.5, style: '#b89c70' }], marks, pois: pois() } };
}

export interface NalatiPopulationFieldSource {
  readonly seed: number;
  readonly world: { readonly res: number; readonly size: number; readonly water: number;
    readonly wet: { readonly type: 'f32'; readonly count: number; readonly data: { readonly file: string } };
    readonly pond: { readonly type: 'f32'; readonly count: number; readonly data: { readonly file: string } } };
  readonly trails: GeographyRows['ground']['trails'];
  readonly river: { readonly from: number; readonly step: number; readonly values: number[][] };
  readonly meadow: typeof meadow;
}

/** The original population query field, without generating terrain or scalar buffers. */
export function nalatiPopulationFieldSource(): NalatiPopulationFieldSource {
  return { seed: SEED, world: { res, size, water: RIVER.level,
    wet: { type: 'f32', count: res * res, data: { file: 'data/geography-wet.bin' } },
    pond: { type: 'f32', count: res * res, data: { file: 'data/geography-pond.bin' } } },
    trails: structuredClone(TERRAIN.trails), river: { from: -250, step: 1,
      values: Array.from({ length: 501 }, (_, index) => [RIVER.z(index - 250), RIVER.half(index - 250)]) }, meadow: structuredClone(meadow) };
}

/** Own the defining 256-square field recipe and original level-six zlib lanes.
 * No process, filesystem, selected world or scheduler is consulted. */
export function nalatiGeographySources(): ReadonlyMap<string, Uint8Array> {
  const names = sourceRows.map(row => row.name.slice('data/geography-'.length, -4));
  const arrays = names.map(() => new Float32Array(res * res));
  const rgb: [number, number, number] = [0, 0, 0], map: [number, number, number] = [0, 0, 0];
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    const x = -size / 2 + i * size / (res - 1), z = -size / 2 + j * size / (res - 1), k = j * res + i;
    const h = TERRAIN.heightAt(x, z), slope = 1 - TERRAIN.normalAt(x, z)[1], forest = forestMask(x, z);
    const surface = surfaceAt(x, z, h, slope);
    groundColor(x, z, h, slope, TERRAIN, rgb); NALATI_MINIMAP.ground(x, z, h, slope, forest, map);
    const values = [Math.max(riverMask(x, z), brookMask(x, z)), Number(nalatiWetAt(x, z)), forest, ...rgb, ...surface, ...map];
    arrays.forEach((array, channel) => {
      const value = values[channel];
      if (value === undefined || !Number.isFinite(value)) throw new Error('Missing native geography channel');
      array[k] = value;
    });
  }
  const files = new Map<string, Uint8Array>();
  arrays.forEach((array, index) => {
    const name = names[index]; if (name === undefined) throw new Error('Missing geography source name');
    files.set(`data/geography-${name}.bin`, encodePortableBytes(new Uint8Array(array.buffer), 6));
  });
  const text = new TextEncoder();
  files.set('boot/geography.generated.json', text.encode(`${JSON.stringify(nalatiGeographyRows())}\n`));
  files.set('boot/geography.generated.d.json.ts', text.encode("import type { GeographyRows } from '../data/geographyTypes';\ndeclare const rows: GeographyRows;\nexport default rows;\n"));
  files.set('data/populationField.generated.json', text.encode(`${JSON.stringify(nalatiPopulationFieldSource())}\n`));
  return files;
}
