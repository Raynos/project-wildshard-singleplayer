import { creaturePoseRows, numericChannelPrograms, type ClientChannels, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';

type Expr = (b: ClientChannels, read: Parameters<NumericChannelOutput['expr']>[1]) => number;
/** Preserve the original arithmetic order; these helpers execute only while baking numeric DAG rows. */
function buildExpressions(b: ClientChannels, read: Parameters<NumericChannelOutput['expr']>[1]) {
  const constants = new Map<number, number>(), reads = new Map<string, number>();
  const n = (x: number): number => { const old = constants.get(x); if (old !== undefined) return old; const value = b.constant(x); constants.set(x, value); return value; };
  const get = (key: string): number => { const old = reads.get(key); if (old !== undefined) return old; const value = read('frame', [key]); reads.set(key, value); return value; };
  const add = (...xs: number[]) => xs.slice(1).reduce((a, v) => b.binary('add', a, v), xs[0] ?? n(0));
  const sub = (a: number, v: number) => b.binary('sub', a, v);
  const mul = (...xs: number[]) => xs.slice(1).reduce((a, v) => b.binary('mul', a, v), xs[0] ?? n(0));
  const div = (a: number, v: number) => b.binary('div', a, v), neg = (a: number) => b.unary('neg', a);
  const sin = (a: number) => b.unary('sin', a), cos = (a: number) => b.unary('cos', a);
  const gt = (a: number, v: number) => b.binary('gt', a, v), choose = (t: number, yes: number, no: number) => b.select(t, yes, no);
  const clamp = (a: number, lo: number, hi: number) => b.binary('max', n(lo), b.binary('min', n(hi), a));
  const smooth = (a: number) => { const k = clamp(a, 0, 1); return mul(b.binary('pow', k, n(2)), sub(n(3), mul(n(2), k))); };
  const step = (a: number, lo: number, hi: number) => smooth(div(sub(a, n(lo)), n(hi - lo)));
  const lerp = (a: number, v: number, t: number) => add(mul(sub(n(1), t), a), mul(t, v));
  const cached = new Map<string, number>();
  const memo = (key: string, run: () => number): number => { const old = cached.get(key); if (old !== undefined) return old; const value = run(); cached.set(key, value); return value; };
  const e = { n, get, add, sub, mul, div, neg, sin, cos, gt, choose, step,
    get t() { return memo('t', () => get('t')); }, get seed() { return memo('seed', () => get('seed')); },
    get atk() { return memo('atk', () => get('attack')); }, get brace() { return memo('brace', () => get('brace')); }, get flinch() { return memo('flinch', () => get('flinch')); },
    get moving() { return memo('moving', () => clamp(div(b.binary('hypot', get('speed'), get('strafe')), n(.5)), 0, 1)); },
    get strafe() { return memo('strafe', () => clamp(div(get('strafe'), n(1.3)), -1, 1)); },
    get fwd() { return memo('fwd', () => clamp(div(get('speed'), n(1.5)), -1, 1)); },
    get dead() { return memo('dead', () => choose(gt(n(0), get('deathT')), n(0), smooth(get('deathT')))); },
    get engaged() { return memo('engaged', () => gt(get('stateIndex'), n(-1))); },
    get attacking() { return memo('attacking', () => gt(e.atk, n(-Number.MIN_VALUE))); },
    get wind() { return memo('wind', () => step(e.atk, 0, .62)); }, get slam() { return memo('slam', () => step(e.atk, .64, .78)); }, get rec() { return memo('rec', () => step(e.atk, .86, 1)); },
    get raise() { return memo('raise', () => { const base = choose(e.engaged, n(.55), n(.15)); return add(choose(e.attacking, add(mul(lerp(base, n(1.35), e.wind), sub(n(1), e.slam)), mul(n(.05), e.slam, sub(n(1), e.rec)), mul(base, e.rec)), base), sub(mul(n(.5), e.brace), mul(n(.9), e.dead))); }); },
    get open() { return memo('open', () => { const base = choose(e.engaged, n(.35), n(.1)); return choose(e.attacking, add(mul(lerp(base, n(.85), e.wind), sub(n(1), e.slam)), mul(n(0), e.slam)), base); }); },
    get spread() { return memo('spread', () => { const base = choose(e.engaged, n(.25), n(0)); return choose(e.attacking, sub(mul(lerp(base, n(.55), e.wind), sub(n(1), e.slam)), mul(n(.25), e.slam)), base); }); },
    get twitch() { return memo('twitch', () => mul(n(.05), sin(add(mul(e.t, n(2.7)), mul(e.seed, n(5)))))); },
  };
  return e;
}
const expressionCache = new WeakMap<ClientChannels, ReturnType<typeof buildExpressions>>();
function expressions(b: ClientChannels, read: Parameters<NumericChannelOutput['expr']>[1]): ReturnType<typeof buildExpressions> {
  let value = expressionCache.get(b);
  if (value === undefined) { value = buildExpressions(b, read); expressionCache.set(b, value); }
  return value;
}

const outputs: NumericChannelOutput[] = [];
function bone(name: string, x: Expr, y: Expr, z: Expr): void {
  for (const [axis, expr] of [['x', x], ['y', y], ['z', z]] as const) outputs.push({ target: name, path: ['rotation', axis], expr });
}
const zero: Expr = b => b.constant(0);
for (const side of ['L', 'R']) {
  const sx = side === 'L' ? 1 : -1;
  bone(`claw${side}_arm`, (b, r) => { const e = expressions(b, r); return e.mul(e.neg(e.raise), e.n(.7)); },
    (b, r) => { const e = expressions(b, r); return e.mul(e.n(sx), e.add(e.mul(e.spread, e.n(.6)), e.twitch)); },
    (b, r) => { const e = expressions(b, r); return e.mul(e.n(sx), e.raise, e.n(.35)); });
  bone(`claw${side}_hand`, (b, r) => { const e = expressions(b, r); return e.mul(e.neg(e.raise), e.n(.5)); },
    (b, r) => { const e = expressions(b, r); return e.mul(e.n(sx), e.spread, e.n(.5)); }, zero);
  bone(`claw${side}_tip`, zero, (b, r) => { const e = expressions(b, r); return e.mul(e.n(sx), e.neg(e.mul(e.open, e.n(.6)))); },
    (b, r) => { const e = expressions(b, r); return e.mul(e.n(-sx), e.open, e.n(.15)); });
  for (const i of [0, 1, 2]) {
    const leg = (b: ClientChannels, r: Parameters<Expr>[1]) => {
      const e = expressions(b, r), { n, get, add, sub, mul, div, sin, cos, choose, gt } = e;
      const lp = b.binary('mod', add(get('phase'), n(['L0', 'R1', 'L2'].includes(side + i) ? 0 : .5)), n(1));
      const air = gt(n(.42), lp), angle = mul(div(lp, n(.42)), n(Math.PI));
      const swing = choose(air, sin(angle), n(0)), along = choose(air, e.neg(cos(angle)), sub(n(1), mul(n(2), div(sub(lp, n(.42)), n(.58)))));
      const lift = mul(swing, n(.42), e.moving), reach = mul(e.strafe, n(sx));
      const idle = mul(sub(n(1), e.moving), n(.03), sin(add(mul(e.t, n(1.3)), n(i * 1.9), mul(e.seed, n(3)))));
      return { n, add, sub, mul, choose, gt, swing, along, lift, reach, idle, get dead() { return e.dead; }, get moving() { return e.moving; }, get fwd() { return e.fwd; }, get flinch() { return e.flinch; } };
    };
    bone(`leg${side}${i}_hip`, zero, (b, r) => { const e = leg(b, r); return e.mul(e.n(-sx), e.along, e.n(.30), e.fwd, e.moving); },
      (b, r) => { const e = leg(b, r); return e.choose(e.gt(e.dead, e.n(0)), e.mul(e.n(sx), e.add(e.n(.15), e.mul(e.n(.5), e.dead))), e.mul(e.n(sx), e.add(e.lift, e.idle, e.mul(e.n(.22), e.reach, e.swing)))); });
    bone(`leg${side}${i}_knee`, zero, zero, (b, r) => { const e = leg(b, r); return e.choose(e.gt(e.dead, e.n(0)), e.mul(e.n(sx), e.n(1.25), e.dead), e.mul(e.n(sx), e.add(e.sub(e.mul(e.n(.25), e.swing, e.moving), e.mul(e.n(.30), e.reach, e.sub(e.n(1), e.swing), e.moving)), e.mul(e.n(.55), e.flinch)))); });
  }
}
outputs.push({ target: 'body', path: ['position', 'y'], expr: (b, r) => {
  const e = expressions(b, r), { n, add, sub, mul, div, sin, choose, gt } = e;
  const bump = choose(gt(e.atk, n(.6)), choose(gt(n(.85), e.atk), sin(mul(div(sub(e.atk, n(.6)), n(.85 - .6)), n(Math.PI))), n(0)), n(0));
  return add(sub(sub(sub(add(add(r('frame', ['dims', 'bodyY']), mul(n(.012), sin(mul(e.get('phase'), n(Math.PI), n(4))), e.moving)), mul(n(.006), sin(add(mul(e.t, n(1.5)), e.seed)))), mul(n(.05), e.brace)), mul(n(.03), e.flinch)), mul(n(.11), e.dead)), mul(n(.03), choose(e.attacking, bump, n(0))));
} });
bone('body', (b, r) => { const e = expressions(b, r); return e.sub(e.add(e.mul(e.n(.05), e.flinch), e.mul(e.n(.08), e.choose(e.attacking, e.step(e.atk, 0, .62), e.n(0)))), e.mul(e.n(.06), e.dead)); }, zero,
  (b, r) => { const e = expressions(b, r); return e.mul(e.strafe, e.n(.06), e.moving); });
bone('head', (b, r) => { const e = expressions(b, r); return e.add(e.mul(e.neg(r('look', ['pitch'])), e.n(.4)), e.mul(e.n(.15), e.dead)); },
  (b, r) => b.binary('mul', r('look', ['yaw']), b.constant(.6)),
  (b, r) => { const e = expressions(b, r); return e.mul(e.n(.06), e.sin(e.add(e.mul(e.t, e.n(3.1)), e.mul(e.seed, e.n(7))))); });

const groups = new Map<string, NumericChannelOutput[]>();
for (const row of outputs) { const group = groups.get(row.target) ?? []; group.push(row); groups.set(row.target, group); }
/** One bone per program permits optional pivots and keeps the existing admission bounds. */
export const CRAB_CLIPS = creaturePoseRows({ group: 'creature.pose', states: ['sidestep', 'attack', 'alert'], look: [.36, 1, .5], squash: 'body',
  programs: [...groups.values()].flatMap((rows, i) => numericChannelPrograms(`crab.${i}`, 'creature.pose', rows.map(out => ({ ...out, target: `joint.${out.target.replaceAll('_', '.')}` })))) });
