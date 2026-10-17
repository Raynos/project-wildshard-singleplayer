import { numericChannelPrograms, type ClientChannels, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';

type Read = Parameters<NumericChannelOutput['expr']>[1];
type Builder = Pick<ClientChannels, 'constant' | 'binary' | 'unary' | 'select'>;
type Node = { op: 'constant'; value: number } | { op: 'read'; owner: string; path: readonly (string | number)[] }
  | { op: 'unary'; kind: Parameters<Builder['unary']>[0]; a: number }
  | { op: 'binary'; kind: Parameters<Builder['binary']>[0]; a: number; b: number }
  | { op: 'select'; test: number; yes: number; no: number };
/** Prune unused tuple branches before replaying each scalar into the existing bounded SDK builder. */
function graph() {
  const nodes: Node[] = [], keys = new Map<string, number>();
  const push = (node: Node): number => { const key = JSON.stringify(node), old = keys.get(key); if (old !== undefined) return old; const at = nodes.length; nodes.push(node); keys.set(key, at); return at; };
  const builder: Builder = { constant: value => push({ op: 'constant', value }),
    binary: (kind, a, b) => push({ op: 'binary', kind, a, b }), unary: (kind, a) => push({ op: 'unary', kind, a }),
    select: (test, yes, no) => push({ op: 'select', test, yes, no }) };
  const read: Read = (owner, path) => push({ op: 'read', owner, path });
  const frames = new WeakMap<ClientChannels, Map<number, number>>();
  const compile = (at: number, target: ClientChannels, input: Read): number => {
    let emitted = frames.get(target);
    if (emitted === undefined) { emitted = new Map(); frames.set(target, emitted); }
    const values = emitted;
    const visit = (index: number): number => {
      const old = values.get(index); if (old !== undefined) return old;
      const node = nodes[index]; if (node === undefined) throw new Error('Missing monkey expression');
      let value: number;
      switch (node.op) {
        case 'constant': value = target.constant(node.value); break;
        case 'read': value = input(node.owner, node.path); break;
        case 'unary': value = target.unary(node.kind, visit(node.a)); break;
        case 'binary': value = target.binary(node.kind, visit(node.a), visit(node.b)); break;
        case 'select': value = target.select(visit(node.test), visit(node.yes), visit(node.no)); break;
        default: throw new Error('Unknown monkey expression');
      }
      values.set(index, value); return value;
    };
    return visit(at);
  };
  return { builder, read, compile };
}
type Triple = readonly [number, number, number];
/** Bake joint arithmetic only; the root's drop/climb/landing authority remains counted shard policy. */
function expression(b: Builder, read: Read) {
  const constants = new Map<number, number>(), cached = new Map<string, number>(), operations = new Map<string, number>();
  const binary = (op: Parameters<ClientChannels['binary']>[0], a: number, c: number) => { const key = `${op}.${a}.${c}`, old = operations.get(key); if (old !== undefined) return old; const at = b.binary(op, a, c); operations.set(key, at); return at; };
  const n = (value: number): number => { const old = constants.get(value); if (old !== undefined) return old; const at = b.constant(value); constants.set(value, at); return at; };
  const memo = (key: string, run: () => number): number => { const old = cached.get(key); if (old !== undefined) return old; const at = run(); cached.set(key, at); return at; };
  const get = (key: string) => memo(key, () => read('scalars', [key]));
  const add = (...xs: number[]) => xs.slice(1).reduce((a, v) => binary('add', a, v), xs[0] ?? n(0));
  const sub = (a: number, v: number) => binary('sub', a, v), neg = (a: number) => b.unary('neg', a);
  const mul = (...xs: number[]) => xs.slice(1).reduce((a, v) => binary('mul', a, v), xs[0] ?? n(0));
  const div = (a: number, v: number) => binary('div', a, v), sin = (a: number) => b.unary('sin', a);
  const max = (a: number, v: number) => binary('max', a, v), min = (a: number, v: number) => binary('min', a, v);
  const gt = (a: number, v: number) => binary('gt', a, v), eq = (a: number, v: number) => b.select(binary('sub', a, v), n(0), n(1));
  const choose = (test: number, yes: number, no: number) => b.select(test, yes, no);
  const smooth = (a: number) => { const k = max(n(0), min(n(1), a)); return mul(binary('pow', k, n(2)), sub(n(3), mul(n(2), k))); };
  const step = (a: number, lo: number, hi: number) => smooth(div(sub(a, n(lo)), n(hi - lo)));
  const bump = (a: number, lo: number, hi: number) => choose(gt(a, n(lo)), choose(gt(n(hi), a), sin(mul(div(sub(a, n(lo)), n(hi - lo)), n(Math.PI))), n(0)), n(0));
  const lerp = (a: number, v: number, t: number) => add(mul(sub(n(1), t), a), mul(t, v));
  const e = { n, get, add, sub, mul, neg, sin, gt, choose, step, bump, lerp, max,
    get dead() { return memo('dead', () => choose(gt(n(0), get('deathT')), n(0), smooth(get('deathT')))); },
    get moving() { return memo('moving', () => max(n(0), min(n(1), div(binary('hypot', get('speed'), get('strafe')), n(1))))); },
    get phase() { return memo('ph', () => mul(get('phase'), n(Math.PI), n(2))); },
    get attacking() { return memo('attacking', () => choose(gt(n(0), get('attack')), n(0), n(1))); },
    get sit() { return memo('sit', () => choose(eq(read('frame', ['stateIndex']), n(0)), n(1), choose(eq(read('frame', ['stateIndex']), n(1)), choose(get('bite'), n(0), choose(eq(get('onGround'), n(1)), n(0), n(1))), n(0)))); },
    get fall() { return memo('fall', () => choose(get('drop'), n(1), n(0))); },
    get climb() { return memo('climb', () => choose(get('climb'), n(1), n(0))); },
    get run() { return memo('run', () => mul(sub(n(1), e.sit), sub(n(1), e.fall), sub(n(1), e.climb), e.moving)); },
    get crouch() { return memo('crouch', () => mul(sub(n(1), e.sit), sub(n(1), e.fall), sub(n(1), e.climb), sub(n(1), e.moving))); },
    get land() { return memo('land', () => bump(get('land'), 0, .35)); },
    get scratch() { return memo('scratch', () => choose(e.sit, bump(div(binary('mod', add(get('t'), mul(get('seed'), n(7))), n(9)), n(9)), .55, .75), n(0))); },
    get lash() { return memo('lash', () => choose(e.attacking, choose(get('bite'), n(0), mul(n(.6), sin(mul(get('t'), n(9))), step(get('attack'), 0, .5))), n(0))); },
    get curl() { return memo('curl', () => sub(add(mul(n(.9), e.sit), mul(n(.4), e.crouch), mul(n(.2), e.run), mul(n(.7), e.climb)), mul(n(.9), e.dead))); },
    joint: (name: string, axis: string) => read(`read.joint.${name.replaceAll('_', '.')}`, ['rotation', axis]),
    look: (axis: 'yaw' | 'pitch') => memo(`look.${axis}`, () => read('look', [axis])),
  };
  return e;
}
type Expressions = ReturnType<typeof expression>;
const rows: NumericChannelOutput[] = [], overlays: NumericChannelOutput[] = [];
const bone = (name: string, run: (v: Expressions) => Triple, outputs = rows) => {
  const cache = new WeakMap<ClientChannels, { plan: ReturnType<typeof graph>; values: Triple }>();
  for (const [i, axis] of ['x', 'y', 'z'].entries()) outputs.push({ target: name, path: ['rotation', axis], expr: (b, read) => {
    let compiled = cache.get(b);
    if (compiled === undefined) { const plan = graph(); compiled = { plan, values: run(expression(plan.builder, plan.read)) }; cache.set(b, compiled); }
    const value = compiled.values[i];
    return value === undefined ? b.constant(0) : compiled.plan.compile(value, b, read);
  } });
};
rows.push({ target: 'body', path: ['position', 'y'], expr: (b, read) => {
  const plan = graph(), v = expression(plan.builder, plan.read), { n, get, add, sub, mul, sin } = v;
  return plan.compile(sub(add(sub(sub(sub(sub(get('bodyY'), mul(n(.13), v.sit)), mul(n(.08), v.run)), mul(n(.05), v.crouch)), mul(n(.12), v.land)), mul(n(.02), sin(mul(v.phase, n(2))), v.run), mul(n(.005), sin(add(mul(get('t'), n(1.6)), get('seed'))))), mul(n(.30), v.dead)), b, read);
} });
bone('body', v => { const { n, get, add, sub, mul, sin } = v; return [sub(add(mul(n(.25), v.sit), mul(n(.65), v.run), mul(n(.35), v.crouch), mul(n(.2), v.fall), mul(n(.35), v.land), mul(n(.35), get('flinch')), v.dead), mul(n(.6), v.climb)), n(0), mul(n(.04), sin(v.phase), v.run)]; });
bone('spine', v => { const { n, get, add, sub, mul } = v; return [add(sub(mul(n(-.15), v.sit), mul(n(.1), v.run)), mul(n(.15), get('brace')), mul(n(.2), v.dead)), mul(v.look('yaw'), n(.25)), n(0)]; });
bone('chest', v => [v.add(v.mul(v.n(-.1), v.sit), v.mul(v.n(.1), v.get('brace'))), v.mul(v.look('yaw'), v.n(.25)), v.n(0)]);
bone('head', v => { const { n, get, add, sub, mul, sin, choose, bump } = v;
  const base = add(sub(sub(mul(n(-.25), v.sit), mul(n(.5), v.run)), mul(n(.3), v.crouch)), mul(n(.35), get('flinch')), mul(n(.5), v.dead), mul(n(.3), v.climb));
  const head = choose(v.attacking, choose(get('bite'), add(base, mul(n(.5), bump(get('attack'), .2, .7))), base), base);
  return [sub(head, mul(v.look('pitch'), n(.6))), mul(v.look('yaw'), n(.5)), mul(n(.08), sin(add(mul(get('t'), n(.9)), mul(get('seed'), n(3)))), v.sit)];
});
for (const side of ['L', 'R']) {
  const sx = side === 'L' ? 1 : -1;
  const arm = (v: Expressions, overlay: boolean) => {
    const { n, get, add, sub, mul, sin, choose, lerp, bump, step, max } = v;
    const sw = sin(add(v.phase, n(sx > 0 ? 0 : Math.PI)));
    let x = add(sub(add(mul(n(.35), v.sit), mul(add(n(.9), mul(n(.7), sw)), v.run), mul(n(.5), v.crouch)), mul(n(1.6), v.fall)), mul(n(side === 'R' ? .25 : .15), v.dead));
    let el = sub(sub(sub(mul(n(-.4), v.sit), mul(add(n(.5), mul(n(.4), max(n(0), v.neg(sw)))), v.run)), mul(n(.6), v.crouch)), mul(n(.6), v.fall));
    let z = mul(n(sx), add(mul(n(.15), v.sit), mul(n(.1), v.run), mul(n(.9), v.fall), mul(n(.35), v.dead)));
    const cs = sin(add(mul(get('t'), n(6)), n(sx > 0 ? 0 : Math.PI)));
    x = choose(v.climb, add(n(-1.9), mul(n(.5), cs)), x); el = choose(v.climb, add(n(-.8), mul(n(.4), cs)), el); z = choose(v.climb, n(sx * .3), z);
    if (!overlay) return { x, el, z };
    x = v.joint(`arm${side}_sh`, 'x'); el = v.joint(`arm${side}_el`, 'x'); z = v.joint(`arm${side}_sh`, 'z');
    if (side === 'L') { const scratch = v.scratch; x = choose(v.gt(scratch, n(0)), lerp(x, n(-1.4), scratch), x); el = choose(v.gt(scratch, n(0)), lerp(el, n(-2.2), scratch), el); z = choose(v.gt(scratch, n(0)), lerp(z, n(sx * .9), scratch), z); }
    const lunge = bump(get('attack'), .15, .75);
    let throwX: number, throwEl = el, throwZ: number;
    if (side === 'R') {
      const wind = step(get('attack'), 0, .58), whip = step(get('attack'), .6, .76), rec = step(get('attack'), .82, 1), target = lerp(n(-2.8), n(.9), whip);
      throwX = add(mul(lerp(lerp(x, n(-2.8), wind), target, whip), sub(n(1), rec)), mul(x, rec));
      throwEl = add(mul(lerp(lerp(el, n(-1.2), wind), n(-.15), whip), sub(n(1), rec)), mul(el, rec));
      throwZ = add(mul(lerp(z, n(sx * .5), wind), sub(n(1), rec)), mul(z, rec));
    } else { const wind = mul(step(get('attack'), 0, .58), sub(n(1), step(get('attack'), .82, 1))); throwX = lerp(x, n(-.6), wind); throwZ = lerp(z, n(sx * .4), wind); }
    return { x: add(choose(v.attacking, choose(get('bite'), lerp(x, n(-1.1), lunge), throwX), x), mul(n(.3), get('brace'))),
      el: choose(v.attacking, choose(get('bite'), lerp(el, n(-.2), lunge), throwEl), el), z: choose(v.attacking, choose(get('bite'), lerp(z, n(sx * .5), lunge), throwZ), z) };
  };
  for (const overlay of [false, true]) {
    bone(`arm${side}_sh`, v => { const a = arm(v, overlay); return [a.x, v.n(0), a.z]; }, overlay ? overlays : rows);
    bone(`arm${side}_el`, v => [arm(v, overlay).el, v.n(0), v.n(0)], overlay ? overlays : rows);
  }
  bone(`leg${side}_hip`, v => { const { n, get, add, sub, mul, sin, choose } = v;
    const sw = sin(add(v.phase, n(sx > 0 ? Math.PI : 0)));
    const hip = sub(sub(sub(sub(sub(add(mul(n(-1.5), v.sit), mul(add(n(-.5), mul(n(.6), sw)), v.run)), v.crouch), mul(n(1.2), v.fall)), mul(n(.6), v.dead)), mul(n(.9), v.climb)), mul(n(.7), v.land));
    const cs = sin(add(mul(get('t'), n(6)), n(sx > 0 ? Math.PI : 0)));
    return [choose(v.climb, add(hip, mul(n(.4), cs)), hip), n(0), mul(n(sx), add(mul(n(.25), v.sit), n(.1), mul(n(.4), v.fall)))];
  });
  bone(`leg${side}_knee`, v => { const { n, get, add, mul, sin, choose, max } = v;
    const sw = sin(add(v.phase, n(sx > 0 ? Math.PI : 0)));
    const knee = add(mul(n(2.3), v.sit), mul(add(n(.9), mul(n(.5), max(n(0), sw))), v.run), mul(n(1.7), v.crouch), mul(n(1.4), v.fall), mul(n(.8), v.dead), mul(n(1.4), v.climb), mul(n(1.2), v.land));
    const cs = sin(add(mul(get('t'), n(6)), n(sx > 0 ? Math.PI : 0)));
    return [choose(v.climb, add(knee, mul(n(.3), cs)), knee), n(0), n(0)];
  });
  bone(`leg${side}_foot`, v => [v.add(v.sub(v.sub(v.mul(v.n(-.4), v.sit), v.mul(v.n(.3), v.run)), v.mul(v.n(.5), v.crouch)), v.mul(v.n(.3), v.fall)), v.n(0), v.n(0)]);
}
bone('tail1', v => { const { n, get, add, sub, mul, sin } = v; return [add(sub(mul(n(-.5), v.curl), mul(n(.4), v.run)), mul(n(.9), v.dead)), n(0), add(mul(n(.25), sin(add(mul(get('t'), n(1.7)), get('seed'))), sub(n(1), v.run)), mul(v.lash, n(.4)))]; });
bone('tail2', v => { const { n, get, add, mul, sin } = v; return [add(mul(n(-.8), v.curl), mul(n(.3), sin(add(mul(get('t'), n(2.1)), get('seed'))), v.sit)), n(0), add(mul(n(.2), sin(add(mul(get('t'), n(1.7)), n(1), get('seed')))), mul(v.lash, n(.6)))]; });
bone('tail3', v => [v.add(v.mul(v.n(-.9), v.curl), v.mul(v.n(.4), v.sin(v.add(v.mul(v.get('t'), v.n(2.6)), v.get('seed'))))), v.n(0), v.lash]);
const recipe = { group: 'creature.pose', states: ['perch', 'attack'], look: [.75, 1.2, .6],
  scalars: [...['t', 'seed', 'speed', 'strafe', 'phase', 'attack', 'brace', 'flinch', 'deathT'].map(key => ({ name: key, path: [key] })),
    { name: 'bodyY', path: ['dims', 'bodyY'] }, ...['bite', 'onGround', 'drop', 'climb', 'land'].map(key => ({ name: key, path: ['mem', key], fallback: 0 }))],
};
function compileRecipe(outputs: NumericChannelOutput[], pass: number) {
  const groups = new Map<string, NumericChannelOutput[]>();
  for (const row of outputs) { const key = `${row.target}.${row.path[0]}`, group = groups.get(key) ?? []; group.push(row); groups.set(key, group); }
  return { ...recipe, ...(pass === 0 ? { squash: 'body' } : {}),
    programs: [...groups.values()].flatMap((group, i) => {
      const bound = group.map(output => ({ ...output, target: `joint.${output.target.replaceAll('_', '.')}` }));
      return numericChannelPrograms(`monkey.${pass}.${i}`, 'creature.pose', bound);
    }) };

}
export const MONKEY_CLIPS = [compileRecipe(rows, 0), compileRecipe(overlays, 1)];
