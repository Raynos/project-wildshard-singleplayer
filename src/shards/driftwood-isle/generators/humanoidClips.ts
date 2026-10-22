import { creaturePoseRows, numericChannelPrograms, type ClientChannels, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';

type Read = Parameters<NumericChannelOutput['expr']>[1];
type Triple = readonly [number, number, number];
/** Compile the two shipping humanoid poses into bounded numeric joint programs. Arithmetic order is retained. */
function expression(b: ClientChannels, read: Read, captain: boolean) {
  const constants = new Map<number, number>(), cached = new Map<string, number>();
  const operations = new Map<string, number>();
  const binary = (op: Parameters<ClientChannels['binary']>[0], a: number, c: number) => { const key = `${op}.${a}.${c}`, old = operations.get(key); if (old !== undefined) return old; const at = b.binary(op, a, c); operations.set(key, at); return at; };
  const n = (value: number): number => { const old = constants.get(value); if (old !== undefined) return old; const at = b.constant(value); constants.set(value, at); return at; };
  const memo = (key: string, run: () => number): number => { const old = cached.get(key); if (old !== undefined) return old; const at = run(); cached.set(key, at); return at; };
  const get = (key: string) => memo(key, () => read('scalars', [key]));
  const add = (...xs: number[]) => xs.slice(1).reduce((a, v) => binary('add', a, v), xs[0] ?? n(0));
  const sub = (a: number, v: number) => binary('sub', a, v), neg = (a: number) => b.unary('neg', a);
  const mul = (...xs: number[]) => xs.slice(1).reduce((a, v) => binary('mul', a, v), xs[0] ?? n(0));
  const div = (a: number, v: number) => binary('div', a, v), sin = (a: number) => b.unary('sin', a);
  const max = (a: number, v: number) => binary('max', a, v), min = (a: number, v: number) => binary('min', a, v);
  const gt = (a: number, v: number) => binary('gt', a, v), choose = (test: number, yes: number, no: number) => b.select(test, yes, no);
  const smooth = (a: number) => { const k = min(n(1), max(n(0), a)); return mul(k, k, sub(n(3), mul(n(2), k))); };
  // rigs.smooth01 uses a squared power; retain its floating-point evaluation, unlike lift's multiplied square.
  const smoothPose = (a: number) => { const k = max(n(0), min(n(1), a)); return mul(binary('pow', k, n(2)), sub(n(3), mul(n(2), k))); };
  const step = (a: number, lo: number, hi: number) => smoothPose(div(sub(a, n(lo)), n(hi - lo)));
  const swingStep = (lo: number, hi: number) => smooth(div(sub(get('attack'), n(lo)), n(hi - lo)));
  const lerp = (a: number, v: number, t: number) => add(mul(sub(n(1), t), a), mul(t, v));
  const e = {
    n, get, add, sub, mul, neg, sin, gt, choose, step,
    get dead() { return memo('dead', () => choose(gt(n(0), get('deathT')), n(0), smoothPose(get('deathT')))); },
    get rise() { return memo('rise', () => sub(n(1), choose(get('init'), smoothPose(get('rise')), n(0)))); },
    get moving() { return memo('moving', () => max(n(0), min(n(1), div(get('speed'), n(captain ? .9 : .8))))); },
    get phase() { return memo('ph', () => mul(get('phase'), n(Math.PI), n(2))); },
    get sway() { return memo('sway', () => sin(add(mul(get('t'), n(captain ? .7 : .8)), mul(get('seed'), n(4))))); },
    get kneel() { return memo('kneel', () => step(e.dead, 0, .5)); },
    get topple() { return memo('topple', () => step(e.dead, .45, 1)); },
    get rage() { return memo('rage', () => choose(gt(n(3), get('ragePhase')), n(0), n(1))); },
    get arm() { return memo('arm', () => mul(sin(e.phase), n(captain ? .3 : .35), e.moving)); },
    get riseArms() { return memo('riseArms', () => {
      const a = sub(n(1), e.rise), bump = choose(gt(a, n(0)), choose(gt(n(.9), a), sin(mul(div(a, n(.9)), n(Math.PI))), n(0)), n(0));
      return choose(gt(e.rise, n(.02)), sub(mul(n(captain ? -2.4 : -2.2), bump), mul(n(.3), e.rise)), n(0));
    }); },
    swing: (key: string, values: Triple): number => memo(`swing.${key}`, () => {
      const wind = swingStep(0, captain ? .62 : .6), cut = swingStep(captain ? .64 : .62, captain ? .8 : .78), rec = swingStep(captain ? .86 : .85, 1);
      return choose(gt(n(0), get('attack')), n(values[0]), add(mul(lerp(lerp(n(values[0]), n(values[1]), wind), n(values[2]), cut), sub(n(1), rec)), mul(n(values[0]), rec)));
    }),
    look: (axis: 'yaw' | 'pitch') => memo(`look.${axis}`, () => read('look', [axis])),
  };
  return e;
}
type Expressions = ReturnType<typeof expression>;
function compile(captain: boolean) {
  const cache = new WeakMap<ClientChannels, Expressions>();
  const e = (b: ClientChannels, read: Read) => { let value = cache.get(b); if (value === undefined) { value = expression(b, read, captain); cache.set(b, value); } return value; };
  const rows: NumericChannelOutput[] = [];
  const bones = new WeakMap<ClientChannels, Map<string, Triple>>();
  const bone = (name: string, run: (v: Expressions) => Triple) => {
    for (const [i, axis] of ['x', 'y', 'z'].entries()) rows.push({ target: name, path: ['rotation', axis], expr: (b, read) => { let values = bones.get(b); if (values === undefined) { values = new Map(); bones.set(b, values); } let tuple = values.get(name); if (tuple === undefined) { tuple = run(e(b, read)); values.set(name, tuple); } return tuple[i] ?? b.constant(0); } });
  };
  const swing = (v: Expressions, key: string): number => {
    switch (key) {
      case 'body': return v.swing(key, captain ? [0, -.3, .5] : [0, -.25, .45]);
      case 'spine': return v.swing(key, captain ? [0, .5, -.55] : [0, .45, -.5]);
      case 'head': return v.swing(key, [0, 0, .2]);
      case 'swX': return v.swing(key, captain ? [.25, -2.9, 1.05] : [.2, -2.7, .95]);
      case 'swZ': return v.swing(key, captain ? [-.3, -1, .25] : [-.25, -.9, .2]);
      case 'elR': return v.swing(key, captain ? [-.45, -1, -.1] : [-.5, -.9, -.15]);
      default: throw new Error('Unknown shipping swing channel');
    }
  };
  rows.push({ target: 'body', path: ['position', 'y'], expr: (b, r) => {
    const v = e(b, r), { n, add, sub, mul, sin, get } = v;
    return add(sub(sub(sub(sub(sub(get('bodyY'), n(captain ? .05 : .06)), mul(n(captain ? .05 : .04), b.unary('abs', sin(v.phase)), v.moving)), mul(n(captain ? .1 : .08), get('brace'))), mul(n(.42), v.kneel)), mul(n(.25), v.topple)), mul(n(.02), v.sway, sub(n(1), v.moving)));
  } });
  bone('body', v => { const { n, add, sub, mul, get } = v;
    const base = add(n(captain ? .16 : .28), mul(n(captain ? .12 : .1), v.moving));
    return [add(add(sub(add(captain ? add(base, mul(n(.1), v.rage)) : base, mul(n(.15), get('brace'))), mul(n(captain ? .4 : .35), v.rise)), mul(n(1.35), v.topple)), swing(v, 'body')), n(0), mul(n(.03), v.sway)];
  });
  bone('spine', v => { const { n, add, mul, sin, get } = v; return [add(n(captain ? .08 : .1), mul(n(.05), get('brace'))), add(mul(n(.06), v.sway), swing(v, 'spine'), mul(v.look('yaw'), n(.3))), mul(n(.04), sin(add(mul(get('t'), n(captain ? .6 : .7)), get('seed'))))]; });
  bone('chest', v => [captain ? v.sub(v.n(.06), v.mul(v.n(.1), v.rage)) : v.n(.08), v.mul(v.look('yaw'), v.n(.2)), v.n(0)]);
  bone('head', v => { const { n, add, sub, mul, sin, get } = v; return [sub(sub(add(n(captain ? -.1 : -.15), mul(n(.2), get('flinch')), mul(n(.25), v.kneel), mul(n(.3), v.topple), swing(v, 'head')), mul(v.look('pitch'), n(.5))), mul(n(captain ? .7 : .6), v.rise)), mul(v.look('yaw'), n(.5)), mul(n(captain ? .1 : .15), sin(add(mul(get('t'), n(captain ? .5 : .6)), get('seed'))))]; });
  bone('armL_sh', v => { const { n, add, sub, mul, sin, get } = v; const base = add(sub(n(captain ? .1 : .15), v.arm), v.riseArms, mul(n(.4), get('brace')), mul(n(.6), v.dead)); return [captain ? sub(base, mul(n(.6), v.rage, add(n(.5), mul(n(.5), sin(mul(get('t'), n(5))))))) : base, n(0), add(n(captain ? .3 : .25), mul(n(.3), v.rise))]; });
  bone('armL_el', v => [v.sub(v.sub(v.n(captain ? -.4 : -.35), v.mul(v.n(.2), v.choose(v.gt(v.n(0), v.arm), v.neg(v.arm), v.n(0)))), v.mul(v.n(.6), v.rise)), v.n(0), v.n(.1)]);
  bone('armR_sh', v => [v.add(swing(v, 'swX'), v.mul(v.arm, v.n(.5)), v.mul(v.riseArms, v.n(.8)), v.mul(v.n(.8), v.dead)), v.n(0), v.sub(swing(v, 'swZ'), v.mul(v.n(.2), v.rise))]);
  bone('armR_el', v => [v.sub(swing(v, 'elR'), v.mul(v.n(.5), v.rise)), v.n(0), v.n(-.1)]);
  bone('armR_hand', v => [v.n(.35), v.n(0), v.n(0)]);
  for (const side of ['L', 'R']) {
    const sw = (v: Expressions) => v.sin(v.add(v.phase, v.n(side === 'L' ? 0 : Math.PI)));
    bone(`leg${side}_hip`, v => [v.sub(v.add(v.sub(v.sub(v.mul(v.n(captain ? -.5 : -.55), sw(v), v.moving), v.mul(v.n(.1), v.get('brace'))), v.n(.1)), v.mul(v.n(.15), v.kneel)), v.mul(v.n(.4), v.topple)), v.n(0), v.n((side === 'L' ? 1 : -1) * (captain ? .07 : .08))]);
    bone(`leg${side}_knee`, v => [v.add(v.mul(v.add(v.n(captain ? .3 : .35), v.mul(v.n(.4), v.choose(v.gt(sw(v), v.n(0)), sw(v), v.n(0)))), v.moving), v.mul(v.n(.15), v.get('brace')), v.n(captain ? .12 : .15), v.mul(v.n(1.9), v.kneel)), v.n(0), v.n(0)]);
    bone(`leg${side}_foot`, v => [v.sub(v.mul(v.n(-.15), sw(v), v.moving), v.n(.1)), v.n(0), v.n(0)]);
  }
  const groups = new Map<string, NumericChannelOutput[]>();
  for (const row of rows) { const key = `${row.target}.${row.path[0]}`, group = groups.get(key) ?? []; group.push(row); groups.set(key, group); }
  return creaturePoseRows({ group: 'creature.pose', look: [1.6, .9, .5], ...(captain ? {} : { squash: 'body' }),
    scalars: [...['t', 'seed', 'speed', 'phase', 'attack', 'brace', 'flinch', 'deathT'].map(key => ({ name: key, path: [key] })),
      { name: 'bodyY', path: ['dims', 'bodyY'] }, ...['init', 'rise', ...(captain ? ['phase'] : [])].map(key => ({ name: key === 'phase' ? 'ragePhase' : key, path: ['mem', key], fallback: 0 }))],
    programs: [...groups.values()].flatMap((outputs, i) => numericChannelPrograms(`${captain ? 'captain' : 'sailor'}.${i}`, 'creature.pose', outputs.map(out => ({ ...out, target: `joint.${out.target.replaceAll('_', '.')}` })))) });
}
export const SAILOR_CLIPS = compile(false);
export const CAPTAIN_CLIPS = compile(true);
