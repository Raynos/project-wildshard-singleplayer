import { numericChannelPrograms } from '@wildshard/sdk/clientChannels';
import sharedUniforms from '../data/sharedUniforms.json' with { type: 'json' };

// G599 N2: the city's per-frame look numbers as a numeric client-channel group the post-graph look evaluates each frame
// (format/postGraphLook `channels`) over its owners: 'view' (the drawn camera seen from the world's root: the eye, the
// near plane, the projection's x / y scale, the root's place in the page; the clock is the evaluation's), 'bag' (the look's uniforms) and
// the lent graph looks it names. It writes the clock, the near plane, the eye and the root's place into the shared
// uniforms, the halo cards' and the streaks' projection, and the silk fog's band window for the eye's height as a
// breakpoint table: the bands' heights and widths are fixed rows, so the first band a ray going down reaches is the
// count of lower edges above the eye, and the last one going up is one less than the count of upper edges at or above it
// (the same window runtime/looks/fogBands.ts computes, exact for bands that run top to bottom, which it flags).
const bands = sharedUniforms.uBands.v4s.map(([x = 0, y = 0]) => ({ lower: x - 3 * y, upper: x + 3 * y }));
const ordered = bands.every((band, k) => k === 0 || (band.upper <= (bands[k - 1]?.upper ?? Infinity) && band.lower <= (bands[k - 1]?.lower ?? Infinity)));
export const NINE_FRAME_GROUP = 'nine.frame';
export const NINE_FRAME_CHANNELS = numericChannelPrograms(NINE_FRAME_GROUP, NINE_FRAME_GROUP, [
  { target: 'bag', path: ['uTime'], expr: b => b.clock('time') },
  { target: 'bag', path: ['uNear'], expr: (_b, read) => read('view', ['near']) },
  ...(['x', 'y', 'z'] as const).map(axis => ({ target: 'bag', path: ['uCam', axis] as const, expr: (_b: unknown, read: (owner: string, path: readonly string[]) => number) => read('view', [`eye${axis.toUpperCase()}`]) })),
  ...(['x', 'y', 'z'] as const).map(axis => ({ target: 'bag', path: ['uRootAt', axis] as const, expr: (_b: unknown, read: (owner: string, path: readonly string[]) => number) => read('view', [`root${axis.toUpperCase()}`]) })),
  { target: 'bag', path: ['uBandWin', 'x'], expr: (b, read) => {
    const eye = read('view', ['eyeY']);
    return bands.reduce((sum, band) => b.binary('add', sum, b.binary('gt', b.constant(band.lower), eye)), b.constant(0));
  } },
  { target: 'bag', path: ['uBandWin', 'y'], expr: (b, read) => {
    const eye = read('view', ['eyeY']);
    return bands.reduce((sum, band) => b.binary('sub', sum, b.binary('gt', eye, b.constant(band.upper))), b.constant(bands.length - 1));
  } },
  { target: 'bag', path: ['uBandWin', 'z'], expr: b => b.constant(ordered ? 1 : 0) },
  { target: 'bag', path: ['uHaloProjection'], expr: (_b, read) => read('view', ['p11']) },
  { target: 'nine-streaks', path: ['projection', 'x'], expr: (_b, read) => read('view', ['p00']) },
  { target: 'nine-streaks', path: ['projection', 'y'], expr: (_b, read) => read('view', ['p11']) },
]);
