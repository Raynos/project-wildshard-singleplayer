// Driftwood's faceted day frame as a numeric channel group (SHARD-PLATFORM W2 C2, H4): every knob the blended preset turns
// (the dome and cumulus graphs' palette, the horizon matte's palette, the toon day light, the colour-ramp fog, the backdrop's
// fog, disc and planet), read from the preset the clock keys and the clock owner the graph day sky fills
// (`@wildshard/sdk/looks/graphDaySky`). The light body's direction is the sun by day and the moon by night.
import { numericChannelPrograms, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';
import { DRIFTWOOD_SKY_DAY } from '../data/skyDay';

export const DRIFTWOOD_SKY_CHANNELS = 'driftwood.sky';
const DOME = 'driftwood-sky-dome', CLOUDS = 'driftwood-sky-cumulus';
const RGB = ['r', 'g', 'b'] as const, XYZ = ['x', 'y', 'z'] as const;
const style = DRIFTWOOD_SKY_DAY;

type Expr = NumericChannelOutput['expr'];
/** a colour copied from the preset (`at`: its path) into a target's three fields */
function colour(target: string, field: string | null, at: readonly string[], axes: readonly [string, string, string] = XYZ): NumericChannelOutput[] {
  return RGB.map((c, i) => ({ target, path: field === null ? [axes[i] ?? 'x'] : [field, axes[i] ?? 'x'], expr: (_b, read) => read('preset', [...at, c]) }));
}
/** the light body: the sun by day, the moon by night */
const body = (axis: 'X' | 'Y' | 'Z'): Expr => (b, read) => b.select(read('clock', ['day']), read('clock', [`sun${axis}`]), read('clock', [`moon${axis}`]));
const bodyVec = (target: string, field: string | null): NumericChannelOutput[] => XYZ.map((a, i) => ({ target, path: field === null ? [a] : [field, a], expr: body((['X', 'Y', 'Z'] as const)[i] ?? 'X') }));

const outputs: NumericChannelOutput[] = [
  // the dome and the cumulus
  ...colour(DOME, 'zenith', ['sky', 'zenith']), ...colour(DOME, 'horizon', ['sky', 'horizon']), ...colour(DOME, 'below', ['sky', 'below']),
  ...colour(DOME, 'sunGlow', ['sky', 'sunGlow']), ...bodyVec(DOME, 'sunDir'),
  { target: DOME, path: ['night'], expr: (_b, read) => read('preset', ['sky', 'night']) },
  ...colour(CLOUDS, 'cloudLit', ['sky', 'cloudLit']), ...colour(CLOUDS, 'cloudShade', ['sky', 'cloudShade']), ...colour(CLOUDS, 'horizon', ['sky', 'horizon']),
  ...colour(CLOUDS, 'sunGlow', ['sky', 'sunGlow']), ...bodyVec(CLOUDS, 'sunDir'),
  // the horizon matte's palette (read by reference)
  ...colour('palette.horizon', 'value', ['sky', 'horizon'], RGB), ...colour('palette.cloudLit', 'value', ['sky', 'cloudLit'], RGB),
  ...colour('palette.sunGlow', 'value', ['sky', 'sunGlow'], RGB), ...bodyVec('palette.sunDir', 'value'),
  // the toon day light and the colour-ramp fog
  { target: 'light.night', path: ['value'], expr: (_b, read) => read('clock', ['night']) },
  ...colour('light.lift', 'value', ['lift'], RGB), ...colour('light.rim', 'value', ['rim'], RGB),
  { target: 'light.cloudShadow', path: ['value'], expr: (_b, read) => read('preset', ['cloudShadow']) },
  ...colour('fog.near', 'value', ['fogNear'], RGB), ...colour('fog.zenith', 'value', ['sky', 'zenith'], RGB),
  // the backdrop's fog, disc and planet
  ...colour('sky.fog', 'color', ['sky', 'horizon'], RGB), ...colour('sky.fogSun', 'value', ['fogSun'], RGB),
  ...colour('sky.discColour', 'color', ['disc'], RGB),
  ...XYZ.map((a): NumericChannelOutput => ({ target: 'sky.disc', path: ['scale', a], expr: (b, read) => b.select(read('clock', ['day']), b.constant(1), b.constant(style.moonDisc)) })),
  ...XYZ.map((a): NumericChannelOutput => ({ target: 'sky.planetSun', path: ['value', a], expr: (_b, read) => read('clock', [`sun${a.toUpperCase()}`]) })),
  // the planet's lit-side haze: the horizon toward the haze colour, by planetHazeDay by day
  ...RGB.map((c, i): NumericChannelOutput => ({ target: 'sky.planetHaze', path: ['value', c], expr: (b, read) => {
    const h = read('preset', ['sky', 'horizon', c]), alpha = b.binary('mul', b.constant(style.planetHazeDay), b.binary('sub', b.constant(1), read('clock', ['night'])));
    return b.binary('add', h, b.binary('mul', b.binary('sub', b.constant(style.planetHaze[i] ?? 0), h), alpha));
  } })),
];

/** the group's programs (build output: data/skyChannels.generated.json) */
export const driftwoodSkyChannels = (): ReturnType<typeof numericChannelPrograms> => numericChannelPrograms(DRIFTWOOD_SKY_CHANNELS, DRIFTWOOD_SKY_CHANNELS, outputs);
