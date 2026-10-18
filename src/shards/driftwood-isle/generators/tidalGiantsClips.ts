import { numericChannelPrograms, type ClientChannels, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';

type Read = Parameters<NumericChannelOutput['expr']>[1];
function expressions(b: ClientChannels, read: Read) {
  const constants = new Map<number, number>(), reads = new Map<string, number>();
  const n = (v: number): number => { const found = constants.get(v); if (found !== undefined) return found; const value = b.constant(v); constants.set(v, value); return value; };
  const get = (name: string): number => { const found = reads.get(name); if (found !== undefined) return found; const value = read('scalars', [name]); reads.set(name, value); return value; };
  const add = (a: number, c: number) => b.binary('add', a, c), sub = (a: number, c: number) => b.binary('sub', a, c);
  const mul = (a: number, c: number) => b.binary('mul', a, c), div = (a: number, c: number) => b.binary('div', a, c);
  const sin = (v: number) => b.unary('sin', v), clamp = (v: number) => b.binary('max', n(0), b.binary('min', n(1), v));
  const choose = (test: number, yes: number, no: number) => b.select(test, yes, no);
  const eq = (v: number) => b.binary('gt', n(.5), b.unary('abs', sub(get('step'), n(v))));
  const progress = (seconds: number) => clamp(div(get('clock'), n(seconds)));
  const dead = clamp(get('death')), alive = sub(n(1), dead);
  const wave = (frequency: number, offset = 0) => sin(add(mul(get('time'), n(frequency)), n(offset)));
  const scale = (value: number, gain: number) => mul(value, n(gain));
  const wind = (seconds: number) => choose(b.binary('gt', n(seconds), get('clock')), progress(seconds), n(0));
  const recoil = (seconds: number) => clamp(sub(n(1), div(sub(get('clock'), n(seconds)), n(.3))));
  return { n, get, add, sub, mul, div, sin, clamp, choose, eq, progress, dead, alive, wave, scale, wind, recoil };
}
type Expr = (e: ReturnType<typeof expressions>) => number;
function clips(kind: 'bellback' | 'colossus') {
  const outputs = new Map<string, NumericChannelOutput[]>();
  const cache = new WeakMap<ClientChannels, ReturnType<typeof expressions>>();
  const out = (joint: string, property: 'rotation' | 'position' | 'scale', axis: 'x' | 'y' | 'z', expr: Expr) => {
    const list = outputs.get(joint) ?? [];
    list.push({ target: `joint.${joint}`, path: [property, axis], expr: (b, r) => {
      let e = cache.get(b); if (e === undefined) { e = expressions(b, r); cache.set(b, e); } return expr(e);
    } }); outputs.set(joint, list);
  };
  out('body', 'position', 'y', e => e.add(e.sub(e.n(kind === 'bellback' ? 1.05 : 1.5), e.scale(e.dead, kind === 'bellback' ? .65 : .85)), e.scale(e.wave(1.7), .025)));
  out('body', 'rotation', 'x', e => e.add(e.scale(e.get('flinch'), .12), e.scale(e.dead, .12)));
  out('body', 'rotation', 'z', e => e.add(e.scale(e.dead, kind === 'bellback' ? .22 : -.1), e.choose(e.eq(4), e.scale(e.wave(16), .08), e.n(0))));
  out('head', 'rotation', 'x', e => e.add(e.scale(e.wave(1.3), .04), e.scale(e.dead, .7)));
  if (kind === 'bellback') {
    out('cradle', 'rotation', 'z', e => e.scale(e.wave(2.1), .025));
    out('bell', 'rotation', 'x', e => e.add(e.scale(e.dead, 1.2), e.mul(e.alive, e.choose(e.eq(1), e.scale(e.recoil(1.2), -.18), e.choose(e.eq(2), e.scale(e.sin(e.scale(e.get('clock'), 11)), .22), e.n(0))))));
    out('clapper', 'rotation', 'x', e => e.mul(e.alive, e.choose(e.eq(1), e.scale(e.wind(1.2), -1.35), e.choose(e.eq(2), e.scale(e.wind(.85), 1.1), e.scale(e.wave(2), .08)))));
    for (let i = 0; i < 4; i++) {
      out(`leg${i}`, 'rotation', 'x', e => e.add(e.scale(e.dead, i < 2 ? -.5 : .5),
        e.mul(e.alive, e.add(e.scale(e.mul(e.get('speed'), e.wave(4.5, i % 3 === 0 ? 0 : Math.PI)), .35),
          i === 0 ? e.choose(e.eq(3), e.scale(e.wind(.85), -1.1), e.n(0)) : e.n(0)))));
      out(`knee${i}`, 'rotation', 'x', e => e.add(e.scale(e.dead, 1.1), e.scale(e.get('brace'), .5)));
    }
  } else {
    out('crown', 'rotation', 'z', e => e.add(e.scale(e.wave(1.2), .025), e.scale(e.dead, -.45)));
    out('crown', 'position', 'y', e => e.sub(e.n(2.75 - 1.5), e.scale(e.dead, .3)));
    for (const axis of ['x', 'y', 'z'] as const) out('heart', 'scale', axis, e => e.mul(e.sub(e.n(1), e.scale(e.dead, .99)), e.add(e.n(1), e.scale(e.wave(3.5), .07))));
    for (const side of ['L', 'R'] as const) out(`cage${side}`, 'rotation', 'y', e => e.scale(e.get('exposed'), side === 'L' ? -1.1 : 1.1));
    for (let i = 0; i < 4; i++) {
      const isFront = i === 0 || i === 3;
      const sweepStep = i === 0 ? 1 : i === 3 ? 2 : -1;
      out(`root${i}`, 'rotation', 'y', e => e.add(e.scale(e.dead, i % 2 === 0 ? .8 : -.8),
        e.choose(e.eq(sweepStep), e.scale(e.sub(e.n(1), e.scale(e.progress(1.15), 2)), i === 0 ? -1 : 1), e.scale(e.wave(1.1, i), .035))));
      out(`root${i}`, 'rotation', 'x', e => e.add(e.scale(e.dead, -.3), isFront ? e.choose(e.eq(3), e.scale(e.wind(1.1), -1.1), e.n(0)) : e.n(0)));
      for (const axis of ['x', 'z'] as const) out(`root${i}`, 'scale', axis, e => e.mul(e.sub(e.n(1), e.scale(e.dead, .55)),
        e.add(e.n(1), e.choose(e.eq(sweepStep), e.scale(e.progress(.9), .65), isFront ? e.choose(e.eq(3), e.scale(e.progress(1.1), .9), e.n(0)) : e.n(0)))));
      out(`bend${i}`, 'rotation', 'x', e => e.add(e.scale(e.dead, .7), isFront ? e.choose(e.eq(3), e.scale(e.wind(1.1), -.65), e.scale(e.wave(1.3, i), .03)) : e.scale(e.wave(1.3, i), .03)));
      out(`tip${i}`, 'rotation', 'y', e => e.add(e.scale(e.wave(1.5, i), .08), e.scale(e.dead, i % 2 === 0 ? 1 : -1)));
    }
  }
  return { group: 'creature.pose', states: ['idle', 'stalk', 'attack', 'alert'],
    scalars: [
      { name: 'step', path: ['mem', 'tg-state'], fallback: 0 }, { name: 'clock', path: ['mem', 'tg-clock'], fallback: 0 },
      { name: 'exposed', path: ['mem', 'tg-exposed'], fallback: 0 }, { name: 'time', path: ['t'] },
      { name: 'death', path: ['deathT'] }, { name: 'speed', path: ['speed'] }, { name: 'brace', path: ['brace'] }, { name: 'flinch', path: ['flinch'] },
    ], programs: [...outputs.values()].flatMap((rows, i) => numericChannelPrograms(`${kind}.${i}`, 'creature.pose', rows)) };
}
export const BELLBACK_CLIPS = clips('bellback');
export const TIDE_ROOT_COLOSSUS_CLIPS = clips('colossus');
