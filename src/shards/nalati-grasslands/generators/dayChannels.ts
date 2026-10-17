import { ClientChannels } from '@wildshard/sdk/clientChannels';
import { parseClientChannels } from '@wildshard/format/clientChannels';
import type { RGB } from '@wildshard/engine/level/data';

type Scalar = number | { scale: number } | { add: number } | null;
const colours = ['sun', 'zenith', 'horizon', 'ground', 'glow', 'hemiSky', 'hemiGround', 'fog', 'fogSun', 'shade', 'rim', 'cloudSun', 'cloud', 'planet', 'shadowTint', 'highTint', 'lift', 'gain', 'vol'] as const;
const numbers = ['sunI', 'stars', 'hemiI', 'env', 'sat', 'contrast', 'volS', 'rays'] as const;
type Frame = Record<typeof colours[number], RGB | null> & Record<typeof numbers[number], Scalar> & { el: number };
const base: Frame = { el: 14, sun: null, zenith: null, horizon: null, ground: null, glow: null, hemiSky: null, hemiGround: null, fog: null, fogSun: null, shade: null, rim: null, cloudSun: null, cloud: null, planet: null, shadowTint: null, highTint: null, lift: null, gain: null, vol: null, sunI: null, stars: null, hemiI: null, env: null, sat: null, contrast: null, volS: null, rays: null };

/** The painted keys retain their spread inheritance, including untouched live baseline fields. */
function frames(): Frame[] {
  const golden: Frame = {
    ...base, el: 6,
    sun: [1.0, 0.72, 0.44], sunI: { scale: 0.85 },
    zenith: [0.12, 0.26, 0.72], horizon: [0.95, 0.74, 0.55], glow: [1.0, 0.62, 0.3],
    hemiSky: [0.55, 0.62, 0.85], hemiGround: [0.32, 0.3, 0.16], hemiI: { scale: 0.9 }, env: { scale: 0.85 },
    fog: [0.86, 0.72, 0.6], fogSun: [1.0, 0.7, 0.42],
    shade: [0.12, 0.13, 0.34], rim: [1.7, 1.15, 0.7],
    cloudSun: [1.0, 0.72, 0.48], cloud: [1.0, 0.93, 0.88], planet: [1.0, 0.92, 0.84],
    shadowTint: [0.9, 0.94, 1.12], highTint: [1.1, 1.0, 0.88], sat: { add: 0.04 },
    vol: [1.0, 0.72, 0.45], volS: { scale: 1.2 },
  };
  const sunset: Frame = {
    ...golden, el: 1,
    sun: [1.0, 0.46, 0.22], sunI: { scale: 0.45 },
    zenith: [0.1, 0.16, 0.45], horizon: [1.0, 0.5, 0.28], ground: [0.2, 0.18, 0.2], glow: [1.0, 0.42, 0.16],
    hemiSky: [0.42, 0.42, 0.66], hemiGround: [0.22, 0.17, 0.12], hemiI: { scale: 0.75 }, env: { scale: 0.6 },
    fog: [0.75, 0.46, 0.38], fogSun: [1.0, 0.45, 0.2],
    shade: [0.12, 0.1, 0.3], rim: [1.8, 0.8, 0.45],
    cloudSun: [1.0, 0.5, 0.3], cloud: [0.95, 0.72, 0.7], planet: [0.95, 0.75, 0.7],
    shadowTint: [0.88, 0.9, 1.15], highTint: [1.12, 0.96, 0.86],
    vol: [1.0, 0.5, 0.25], volS: { scale: 1.1 },
  };
  const afterglow: Frame = {
    ...sunset, el: -3,
    sun: [0.8, 0.4, 0.3], sunI: 0,
    zenith: [0.06, 0.09, 0.28], horizon: [0.7, 0.34, 0.26], ground: [0.12, 0.1, 0.14], glow: [0.9, 0.3, 0.14],
    hemiSky: [0.3, 0.32, 0.55], hemiGround: [0.12, 0.1, 0.1], hemiI: { scale: 0.7 }, env: { scale: 0.35 },
    fog: [0.42, 0.3, 0.36], fogSun: [0.9, 0.4, 0.22],
    shade: [0.09, 0.08, 0.24], rim: [0.9, 0.5, 0.45],
    cloudSun: [0.9, 0.42, 0.34], cloud: [0.62, 0.46, 0.52], planet: [0.8, 0.62, 0.66],
    shadowTint: [0.86, 0.9, 1.18], highTint: [1.06, 0.95, 0.92], sat: { add: -0.02 },
    vol: [0.8, 0.4, 0.3], volS: { scale: 0.4 }, rays: 0,
  };
  const blue: Frame = {
    ...afterglow, el: -9,
    sun: [0.5, 0.6, 1.0], sunI: 0,
    zenith: [0.02, 0.045, 0.14], horizon: [0.14, 0.14, 0.26], ground: [0.05, 0.06, 0.09], glow: [0.35, 0.16, 0.14], stars: 0.35,
    hemiSky: [0.22, 0.28, 0.5], hemiGround: [0.06, 0.07, 0.08], hemiI: { scale: 0.7 }, env: { scale: 0.18 },
    fog: [0.12, 0.13, 0.22], fogSun: [0.3, 0.22, 0.3],
    shade: [0.05, 0.07, 0.2], rim: [0.5, 0.55, 0.9],
    cloudSun: [0.4, 0.35, 0.5], cloud: [0.2, 0.2, 0.3], planet: [0.72, 0.72, 0.85],
    shadowTint: [0.84, 0.94, 1.24], highTint: [0.94, 0.98, 1.14], sat: { add: -0.12 },
    vol: [0.4, 0.45, 0.7], volS: { scale: 0.15 }, rays: 0,
  };
  const night: Frame = {
    ...blue, el: -16,
    sun: [0.5, 0.6, 1.0], sunI: 0,
    zenith: [0.012, 0.026, 0.085], horizon: [0.06, 0.08, 0.16], ground: [0.03, 0.04, 0.06], glow: [0.1, 0.1, 0.16], stars: 1,
    hemiSky: [0.2, 0.28, 0.55], hemiGround: [0.05, 0.06, 0.08], hemiI: { scale: 0.65 }, env: { scale: 0.12 },
    fog: [0.05, 0.07, 0.14], fogSun: [0.14, 0.18, 0.32],
    shade: [0.04, 0.06, 0.18], rim: [0.45, 0.6, 1.05],
    cloudSun: [0.3, 0.34, 0.5], cloud: [0.1, 0.12, 0.2], planet: [0.62, 0.66, 0.8],
    shadowTint: [0.82, 0.95, 1.28], highTint: [0.9, 0.98, 1.16], lift: [0.0, 0.006, 0.02], sat: { add: -0.18 },
    vol: [0.35, 0.45, 0.8], volS: { scale: 0.25 }, rays: 0,
  };
  return [base, golden, sunset, afterglow, blue, night];
}

/** Existing H4 ops, in the old descending DayCycle.segment and blendSteppeKey operand order.
 * Each scalar has its own bounded program: all live reads are captured before any output is written. */
export function nalatiDayChannels(): ReturnType<typeof parseClientChannels> {
  const keys = frames(), elevations = [14, 6, 1, -3, -9, -16];
  const fields = [...colours.flatMap(field => [0, 1, 2].map(axis => ({ field, axis }))), ...numbers.map(field => ({ field, axis: null }))];
  return fields.map(({ field, axis }, index) => {
    const b = new ClientChannels(`nalati.day.${String(index)}`), path = axis === null ? [field] : [field, axis];
    const el = b.read('elevation'), live = b.read('baseline');
    const values = keys.map(key => {
      const raw = key[field], value = Array.isArray(raw) ? raw[axis ?? 0] : raw;
      if (value === null) return live;
      if (value === undefined) throw new Error('Missing painted day key');
      if (typeof value === 'number') return b.constant(value);
      return 'scale' in value ? b.binary('mul', live, b.constant(value.scale)) : b.binary('add', live, b.constant(value.add));
    });
    const zero = b.constant(0), one = b.constant(1), two = b.constant(2), three = b.constant(3);
    let a = values[5] ?? zero, end = a, t = zero;
    for (let i = 4; i >= 0; i--) {
      const upper = elevations[i], lower = elevations[i + 1], start = values[i], next = values[i + 1];
      if (upper === undefined || lower === undefined || start === undefined || next === undefined) throw new Error('Missing painted day segment');
      const u = b.binary('div', b.binary('sub', b.constant(upper), el), b.constant(upper - lower));
      const eased = b.binary('mul', b.binary('mul', u, u), b.binary('sub', three, b.binary('mul', two, u)));
      const below = b.binary('gt', b.constant(lower), el);
      a = b.select(below, a, start); end = b.select(below, end, next); t = b.select(below, t, eased);
    }
    // The two clamped endpoints blend a key with itself at zero, just as the old clock does.
    const top = values[0] ?? zero, bottom = values[5] ?? zero;
    const above = b.select(b.binary('gt', b.constant(14), el), zero, one), below = b.select(b.binary('gt', el, b.constant(-16)), zero, one);
    a = b.select(above, top, b.select(below, bottom, a));
    end = b.select(above, top, b.select(below, bottom, end));
    t = b.select(above, zero, b.select(below, zero, t));
    b.output('value', b.binary('add', a, b.binary('mul', b.binary('sub', end, a), t)));
    const program = parseClientChannels([{ ...b.build(), numeric: { group: 'nalati.day',
      inputs: [{ input: 'elevation', owner: 'clock', path: ['elevation'] }, { input: 'baseline', owner: 'day', path }],
      outputs: [{ property: 'value', target: axis === null ? 'key' : `key.${field}`, path: [axis === null ? field : ['x', 'y', 'z'][axis] ?? 'x'] }], restoreOnly: [] } }])[0];
    if (program === undefined) throw new Error('Missing painted day program');
    return program;
  });
}
