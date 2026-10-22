// Pine's rain graph params as a numeric channel group (SHARD-PLATFORM W2 C2, H4): the curtain's fall (its velocity, slanted
// by the wind, and its world-anchored offset wrapped into the box round the eye), its streak length and alpha, the splashes'
// clock and alpha, and the lens drops' clock (three times as fast under a roof) and smoothed wetness, read from the frame's
// reading the rain fills (`rain`: on, rain, dry, cover, lookY, room, radius, slots, windX, windZ). The CPU splashes, the
// cover map and the draw range stay in game/weather/rainPresentation.ts.
import { numericChannelPrograms, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';
import weather from '../data/weatherLook.json' with { type: 'json' };

const { PINE_RAIN_PROGRAMS } = weather;

type Expr = NumericChannelOutput['expr'];
const { rain: CURTAIN, splash: SPLASH, lens: LENS, channels: GROUP } = PINE_RAIN_PROGRAMS;
/** the fall: metres a second down, and the slant × the wind */
const SPEED = 9.5, SLANT = 0.3;
const at = (field: string): Expr => (_b, read) => read('rain', [field]);
/** the rain while it falls (0 off) */
const falling: Expr = (b, read) => b.select(read('rain', ['on']), read('rain', ['rain']), b.constant(0));
/** a + k × the rain */
const byRain = (a: number, k: number): Expr => (b, read) => b.binary('add', b.constant(a), b.binary('mul', b.constant(k), read('rain', ['rain'])));
const velocity = (axis: 'x' | 'y' | 'z'): Expr => (b, read) => axis === 'y' ? b.constant(-SPEED) : b.binary('mul', read('rain', [axis === 'x' ? 'windX' : 'windZ']), b.constant(SLANT));
/** the offset moved by the velocity while it rains, wrapped into the box (2 × radius) */
const offset = (axis: 'x' | 'y' | 'z'): Expr => (b, read) => {
  const o = b.local(0), box = b.binary('mul', b.constant(2), read('rain', ['radius']));
  const moved = b.binary('add', o, b.binary('mul', velocity(axis)(b, read), b.clock('delta')));
  const next = b.select(read('rain', ['on']), b.binary('mod', b.binary('add', b.binary('mod', moved, box), box), box), o);
  b.retain(o, next);
  return next;
};
/** a clock that stops in a practice room, running `rate` × as fast */
const clock = (rate: Expr): Expr => (b, read) => {
  const t = b.local(0), next = b.select(read('rain', ['room']), t, b.binary('add', t, b.binary('mul', b.clock('delta'), rate(b, read))));
  b.retain(t, next);
  return next;
};
/** the lens drops land while the rain reaches the eye (facing the open sky, fewer under the crowns), ~6.8 at full exposure */
const lensWet: Expr = (b, read) => {
  const w = b.local(0), look = b.sample(read('rain', ['lookY']), [[-0.55, 0], [0.25, 1]], 'smoothstep');
  const open = b.binary('sub', b.constant(1), b.binary('mul', b.constant(0.7), read('rain', ['cover'])));
  const expose = b.select(read('rain', ['dry']), b.constant(0), b.binary('mul', falling(b, read), b.binary('mul', open, look)));
  const share = b.binary('min', b.constant(1), b.binary('div', b.constant(6.8), read('rain', ['slots'])));
  const toward = b.binary('mul', b.binary('sub', b.binary('mul', expose, share), w), b.binary('min', b.constant(1), b.binary('div', b.clock('delta'), b.constant(2.5))));
  const next = b.select(read('rain', ['room']), b.constant(0), b.binary('add', w, toward));
  b.retain(w, next);
  return next;
};
const XYZ = ['x', 'y', 'z'] as const;
const outputs: NumericChannelOutput[] = [
  ...XYZ.map((a): NumericChannelOutput => ({ target: CURTAIN, path: ['velocity', a], expr: velocity(a) })),
  ...XYZ.map((a): NumericChannelOutput => ({ target: CURTAIN, path: ['offset', a], expr: offset(a) })),
  { target: CURTAIN, path: ['length'], expr: byRain(0.42, 0.26) }, { target: CURTAIN, path: ['alpha'], expr: byRain(0.16, 0.2) },
  { target: SPLASH, path: ['time'], expr: clock(b => b.constant(1)) }, { target: SPLASH, path: ['alpha'], expr: byRain(0.24, 0.26) },
  { target: LENS, path: ['clock'], expr: clock((b, read) => b.select(at('dry')(b, read), b.constant(3), b.constant(1))) }, { target: LENS, path: ['wet'], expr: lensWet },
];

/** the group's programs (build output, beside the sky's: data/skyChannels.generated.json) */
export const pineRainChannels = (): ReturnType<typeof numericChannelPrograms> => numericChannelPrograms(GROUP, GROUP, outputs);
