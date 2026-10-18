import { numericChannelPrograms, type ClientChannels, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';

type Read = Parameters<NumericChannelOutput['expr']>[1];
type Expr = (b: ClientChannels, r: Read) => number;
function math(b: ClientChannels, r: Read) {
  const constants = new Map<number, number>(), reads = new Map<string, number>();
  const n = (v: number) => { const old = constants.get(v); if (old !== undefined) return old; const value = b.constant(v); constants.set(v, value); return value; };
  const get = (key: string) => { const old = reads.get(key); if (old !== undefined) return old; const value = r('frame', [key]); reads.set(key, value); return value; };
  const add = (...v: number[]) => v.slice(1).reduce((a, c) => b.binary('add', a, c), v[0] ?? n(0));
  const mul = (...v: number[]) => v.slice(1).reduce((a, c) => b.binary('mul', a, c), v[0] ?? n(1));
  const sub = (a: number, c: number) => b.binary('sub', a, c);
  const clamp = (v: number) => b.binary('max', n(0), b.binary('min', n(1), v));
  const phase = (lo: number, hi: number) => clamp(b.binary('div', sub(get('attack'), n(lo)), n(hi - lo)));
  const dead = clamp(get('deathT'));
  const walk = mul(b.unary('sin', mul(get('phase'), n(Math.PI * 2))), clamp(get('speed')));
  const wind = mul(phase(0, .42), sub(n(1), phase(.44, .60)));
  const thrust = mul(phase(.42, .55), sub(n(1), phase(.65, 1)));
  return { n, get, add, mul, sub, clamp, phase, dead, walk, wind, thrust };
}
/** The runner's frame.attack covers windup only. Poses observe the guest's full attack clock instead. */
function clip(id: string, rows: NumericChannelOutput[]) {
  const prefix = id === 'brine-puffer' ? 'puffer' : id === 'conch-duelist' ? 'conch' : 'mantis';
  const duration = id === 'brine-puffer' ? 2.1 : id === 'conch-duelist' ? 1.6 : 1.37;
  const secondDuration = id === 'conch-duelist' ? 1.45 : 2.05;
  return { group: 'creature.pose', states: ['stalk', 'attack', 'alert'],
    scalars: [{ name: 'clock', path: ['mem', `${prefix}-clock`], fallback: 0 }, { name: 'stage', path: ['mem', `${prefix}-st`], fallback: 0 }],
    programs: rows.flatMap((row, i) => numericChannelPrograms(`${id}.${i}`, 'creature.pose', [{ ...row,
      target: `joint.${row.target.replaceAll('_', '.')}`, expr: (b, read) => {
        let attack: number | undefined;
        const observe: Read = (owner, path) => {
          if (owner !== 'frame' || path[0] !== 'attack') return read(owner, path);
          if (attack !== undefined) return attack;
          const stage = read('scalars', ['stage']), clock = read('scalars', ['clock']);
          const second = b.binary('gt', stage, b.constant(2.5));
          const total = b.select(second, b.constant(secondDuration), b.constant(duration));
          const first = b.binary('gt', stage, b.constant(.5)), upper = b.binary('gt', b.constant(3.5), stage);
          const recovery = b.binary('gt', stage, b.constant(1.5));
          const active = b.select(second, upper, b.select(recovery, b.constant(0), first));
          attack = b.select(active, b.binary('div', clock, total), b.constant(-1));
          return attack;
        };
        return row.expr(b, observe);
      } }])) };
}
function output(target: string, property: 'rotation' | 'position' | 'scale', axis: 'x' | 'y' | 'z', expr: Expr): NumericChannelOutput {
  return { target, path: [property, axis], expr };
}
const puffer: NumericChannelOutput[] = [];
for (const axis of ['x', 'y', 'z'] as const) puffer.push(output('belly', 'scale', axis, (b, r) => {
  const e = math(b, r);
  // Burst at .9 / 2.1 of the total attack: expansion is held until that beat, then visibly deflates.
  const swell = e.mul(e.phase(0, .39), e.sub(e.n(1), e.phase(.43, .61)));
  return e.sub(e.add(e.n(1), e.mul(e.n(.57), swell)), e.mul(e.n(.55), e.dead));
}));
puffer.push(output('body', 'rotation', 'z', (b, r) => { const e = math(b, r); return e.add(e.mul(e.n(.10), e.walk), e.mul(e.n(1.30), e.dead)); }),
  output('body', 'position', 'y', (b, r) => { const e = math(b, r); return e.sub(e.n(.43), e.mul(e.n(.18), e.dead)); }),
  output('head', 'rotation', 'x', (b, r) => { const e = math(b, r); return e.add(e.mul(e.n(.08), b.unary('sin', e.mul(e.get('t'), e.n(3)))), e.mul(e.n(.35), e.get('flinch'))); }));
for (const side of ['L', 'R']) {
  const sign = side === 'L' ? 1 : -1;
  puffer.push(output(`fin${side}`, 'rotation', 'x', (b, r) => { const e = math(b, r); return e.mul(e.n(sign * .42), e.walk, e.sub(e.n(1), e.dead)); }),
    output(`fin${side}`, 'rotation', 'z', (b, r) => { const e = math(b, r); return e.mul(e.n(sign * .65), e.dead); }));
}
puffer.push(output('tail', 'rotation', 'y', (b, r) => { const e = math(b, r); return e.mul(e.n(.18), b.unary('sin', e.mul(e.get('t'), e.n(4))), e.sub(e.n(1), e.dead)); }));
export const BRINE_PUFFER_CLIPS = clip('brine-puffer', puffer);

const conch: NumericChannelOutput[] = [
  output('body', 'scale', 'y', (b, r) => { const e = math(b, r); return e.sub(e.n(1), e.mul(e.n(.70), e.dead)); }),
  output('shell', 'rotation', 'y', (b, r) => { const e = math(b, r); return e.add(e.mul(e.n(1.1), e.wind), e.mul(e.n(.7), e.dead)); }),
  output('shell', 'rotation', 'z', (b, r) => { const e = math(b, r); return e.mul(e.n(-1.1), e.dead); }),
  output('guard', 'rotation', 'x', (b, r) => { const e = math(b, r); return e.add(e.mul(e.n(-1.2), e.wind), e.mul(e.n(.5), e.dead)); }),
  output('thrust', 'rotation', 'x', (b, r) => { const e = math(b, r); return e.add(e.mul(e.n(.7), e.wind), e.mul(e.n(-.65), e.thrust), e.mul(e.n(.7), e.get('flinch'))); }),
  output('thrust', 'rotation', 'y', (b, r) => { const e = math(b, r); return e.mul(e.n(-.55), e.thrust); }),
  output('foot', 'scale', 'z', (b, r) => { const e = math(b, r); return e.add(e.n(1), e.mul(e.n(.12), e.walk)); }),
  output('head', 'rotation', 'x', (b, r) => { const e = math(b, r); return e.add(e.mul(e.n(-.18), e.wind), e.mul(e.n(.65), e.dead)); }),
];
conch.push(output('guard', 'rotation', 'z', (b, r) => b.select(b.binary('gt', r('scalars', ['stage']), b.constant(2.5)), b.constant(-1.1), b.constant(0))));
export const CONCH_DUELIST_CLIPS = clip('conch-duelist', conch);

const mantis: NumericChannelOutput[] = [
  output('body', 'position', 'y', (b, r) => { const e = math(b, r); return e.sub(e.sub(e.n(.86), e.mul(e.n(.22), e.wind)), e.mul(e.n(.60), e.dead)); }),
  output('body', 'rotation', 'x', (b, r) => { const e = math(b, r); return e.add(e.mul(e.n(.38), e.thrust), e.mul(e.n(-.15), e.wind), e.mul(e.n(.45), e.get('brace'))); }),
  output('head', 'rotation', 'x', (b, r) => { const e = math(b, r); return e.add(e.mul(e.n(-.3), e.thrust), e.mul(e.n(.7), e.dead)); }),
];
for (const side of ['L', 'R']) {
  const sign = side === 'L' ? 1 : -1;
  mantis.push(output(`arm${side}`, 'rotation', 'x', (b, r) => { const e = math(b, r); return e.add(e.mul(e.n(-.9), e.wind, b.select((side === 'L' ? b.binary('gt', e.n(1.5), r('scalars', ['beat'])) : b.binary('gt', r('scalars', ['beat']), e.n(1.5))), e.n(1), e.n(.3))), e.mul(e.n(1.2), e.thrust, b.select((side === 'L' ? b.binary('gt', e.n(1.5), r('scalars', ['beat'])) : b.binary('gt', r('scalars', ['beat']), e.n(1.5))), e.n(1), e.n(.3))), e.mul(e.n(.8), e.dead)); }),
    output(`hook${side}`, 'rotation', 'z', (b, r) => { const e = math(b, r); return e.mul(e.n(sign), e.add(e.mul(e.n(.7), e.wind), e.mul(e.n(-.9), e.thrust))); }));
  for (let i = 0; i < 2; i++) {
    mantis.push(output(`leg${side}${i}`, 'rotation', 'x', (b, r) => { const e = math(b, r); return e.mul(e.n(sign * (i ? -.45 : .45)), e.walk); }),
      output(`leg${side}${i}`, 'rotation', 'z', (b, r) => { const e = math(b, r); return e.mul(e.n(sign), e.add(e.mul(e.n(.35), e.wind), e.mul(e.n(1.1), e.dead))); }),
      output(`knee${side}${i}`, 'rotation', 'z', (b, r) => { const e = math(b, r); return e.mul(e.n(-sign), e.add(e.mul(e.n(.4), e.wind), e.mul(e.n(1.45), e.dead))); }));
  }
}
export const SPLINTER_MANTIS_CLIPS = { ...clip('splinter-mantis', mantis), scalars: [...clip('splinter-mantis', []).scalars, { name: 'beat', path: ['mem', 'mantis-beat'], fallback: 1 }] };
