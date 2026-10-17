import * as v from 'valibot';
import { isJsonData } from './json';

/** Serialized photographic sky presets. Client presentation is owned by the game. */
export const SKY_PRESET = {
  key: 'name', bg: 'number', env: 'number', light: 'colour', lightI: 'number', hemiSky: 'colour', hemiGround: 'colour', hemiI: 'number',
  fogSun: 'colour', fogDist: 'number', fogHeight: 'number', vol: 'number', volColor: 'colour', rays: 'number',
  glow: 'colour', disc: 'colour', halo: 'colour', haloO: 'number', cloudSun: 'colour', cloudLit: 'colour', cloudA: 'number',
  far: 'colour', lamps: 'number', sat: 'number',
} as const;

const n = v.pipe(v.number(), v.finite()), pair = v.tuple([n, n]), rgb = v.tuple([n, n, n]), colour = v.union([n, rgb]);
const numberKey = v.picklist(['bg', 'env', 'lightI', 'hemiI', 'fogDist', 'fogHeight', 'vol', 'rays', 'haloO', 'cloudA', 'lamps', 'sat']);
const colourKey = v.picklist(['light', 'hemiSky', 'hemiGround', 'fogSun', 'volColor', 'glow', 'disc', 'halo', 'cloudSun', 'cloudLit', 'far']);
const preset = v.strictObject({ key: v.string(), bg: n, env: n, light: colour, lightI: n, hemiSky: colour, hemiGround: colour, hemiI: n,
  fogSun: colour, fogDist: n, fogHeight: n, vol: n, volColor: colour, rays: n, glow: colour, disc: colour, halo: colour, haloO: n,
  cloudSun: colour, cloudLit: colour, cloudA: n, far: colour, lamps: n, sat: n });

/** Decode authored JSON at the clock boundary, including tuple arity and weather field kinds. */
export const KEYED_SKY = v.pipe(v.unknown(), v.check(isJsonData, 'Keyed sky requires plain JSON'), v.strictObject({
  dayFraction: n, cycleMinutes: n, start: n,
  response: v.strictObject({ shadowStep: n, overcastLamps: n, domeDim: n, horizonCeiling: n,
    overcastHorizon: v.strictObject({ luma: n, tint: rgb, amount: n }), mistHorizon: v.strictObject({ luma: n, tint: rgb, amount: n }),
    moonDisc: n, minLight: n, lightBase: n, above: pair, residentKeys: v.pipe(n, v.integer(), v.minValue(3), v.maxValue(8)), prefetch: n,
    environment: v.strictObject({ width: v.pipe(n, v.integer(), v.minValue(16), v.maxValue(4096), v.multipleOf(2)), smallWidth: v.pipe(n, v.integer(), v.minValue(16), v.maxValue(4096), v.multipleOf(2)), refresh: v.pipe(n, v.minValue(0.01)) }) }),
  packedKeys: v.exactOptional(v.record(v.string(), v.strictObject({ file: v.string(), width: v.pipe(n, v.integer(), v.minValue(1), v.maxValue(8192)), height: v.pipe(n, v.integer(), v.minValue(1), v.maxValue(8192)), horizon: rgb }))),
  schedule: v.array(v.strictObject({ phase: v.picklist(['dawn', 'day', 'golden', 'dusk', 'night']), from: n, to: n, minutes: n })),
  keys: v.record(v.string(), v.strictObject({ id: v.string(), sunU: n, sunEl: n, paint: n })),
  moonKey: v.string(), keyFiles: v.strictObject({ color: v.string(), gain: v.string() }), presets: v.record(v.string(), preset),
  frames: v.array(v.tuple([n, v.string()])), phases: v.record(v.string(), n),
  fixed: v.strictObject({ midday: n, golden: n, sunset: n, night: n }), namedPhases: v.strictObject({ dawn: n, noon: n, dusk: n, night: n }),
  sun: v.strictObject({ rise: n, sweep: n, noon: n, nightRise: n, nightSweep: n, nadir: n }), moon: v.strictObject({ rise: n, sweep: n, base: n, arc: n }),
  night: v.strictObject({ rise: pair, fall: pair }), fade: v.strictObject({ sunY: pair, moonIn: pair, moonOut: pair }), nightShadow: n,
  dusk: pair, dawn: v.strictObject({ at: n, width: pair }), dome: v.strictObject({ name: v.string(), radius: n, segments: pair }),
  overcast: v.array(v.variant('op', [
    v.strictObject({ op: v.literal('scale'), key: v.union([numberKey, colourKey]), by: n, curve: v.exactOptional(pair) }),
    v.strictObject({ op: v.literal('add'), key: numberKey, by: n }), v.strictObject({ op: v.literal('atLeast'), key: numberKey, by: n }),
    v.strictObject({ op: v.literal('grey'), key: colourKey, by: n, tint: rgb }),
    v.strictObject({ op: v.literal('toward'), key: colourKey, by: n, colour: rgb, lit: v.exactOptional(n) }),
  ])),
}));


export type KeyedSkyStyle = v.InferOutput<typeof KEYED_SKY>;
export type SkyKeyRow = KeyedSkyStyle['keys'][string];
/** Admit data before constructing clocks, graphs or textures. */
export function parseKeyedSky(input: unknown): KeyedSkyStyle {
  const rows = v.parse(KEYED_SKY, input);
  if (rows.frames.length < 2 || !(rows.dayFraction > 0 && rows.dayFraction < 1) || rows.cycleMinutes <= 0) throw new Error('Invalid keyed sky clock');
  let previous = -Infinity;
  for (const [phase, id] of rows.frames) {
    if (phase < previous || phase < 0 || phase > 1 || rows.presets[id] === undefined) throw new Error('Invalid keyed sky frame');
    previous = phase;
  }
  for (const row of Object.values(rows.presets)) if (rows.keys[row.key] === undefined) throw new Error('Missing keyed sky image');
  if (rows.keys[rows.moonKey] === undefined) throw new Error('Missing keyed sky moon');
  if (rows.packedKeys !== undefined) for (const id of Object.keys(rows.keys)) if (rows.packedKeys[id] === undefined) throw new Error('Incomplete packed sky');
  return rows;
}
