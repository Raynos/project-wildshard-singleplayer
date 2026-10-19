import { numericChannelPrograms, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';

type Read = Parameters<NumericChannelOutput['expr']>[1];
type Builder = Parameters<NumericChannelOutput['expr']>[0];

/** V7's exact 22-joint rig. Source underscores are encoded as dots by the existing pose binder. */
export const MANTIS_NATIVE_JOINTS = ['body', 'neck', 'head', 'abdomen',
  ...[-1, 1].flatMap(side => [`wing${side}_0`, `wing${side}_1`, `leg${side}_0`, `leg${side}_0_knee`,
    `leg${side}_1`, `leg${side}_1_knee`, `raptor${side}`, `raptor${side}_elbow`, `raptor${side}_hook`])];

function motion(b: Builder, read: Read) {
  const n = (v: number) => b.constant(v), add = (a: number, c: number) => b.binary('add', a, c);
  const sub = (a: number, c: number) => b.binary('sub', a, c), mul = (a: number, c: number) => b.binary('mul', a, c);
  const clamp = (a: number) => b.binary('max', n(0), b.binary('min', n(1), a));
  const smooth = (a: number) => { const t = clamp(a); return mul(mul(t, t), sub(n(3), mul(n(2), t))); };
  // Build only the channels used by this output; the evaluator deliberately caps each DAG at 128 nodes.
  const memo = <T>(make: () => T): (() => T) => { let value: { result: T } | undefined; return () => { value ??= { result: make() }; return value.result; }; };
  const clock = memo(() => read('scalars', ['clock'])), stage = memo(() => read('scalars', ['stage']));
  const dead = memo(() => smooth(read('frame', ['deathT']))), live = memo(() => sub(n(1), dead()));
  const eq = (value: number) => mul(b.binary('gt', stage(), n(value - .5)), b.binary('gt', n(value + .5), stage()));
  const first = memo(() => eq(1)), second = memo(() => eq(3));
  const ramp = (lo: number, hi: number) => smooth(b.binary('div', sub(clock(), lo), sub(hi, lo)));
  const windup = memo(() => b.select(first(), n(.75), n(.45)));
  const end = memo(() => b.select(first(), n(1.37), n(2.05)));
  const rawTell = memo(() => mul(ramp(n(0), mul(windup(), n(.8))), sub(n(1), ramp(windup(), add(windup(), n(.10))))));
  const rawCut = memo(() => mul(ramp(windup(), add(windup(), n(.10))), sub(n(1), ramp(add(windup(), n(.5)), end()))));
  const a = { get tell() { return rawTell(); }, get cut() { return rawCut(); } }, c = a;
  const tell = memo(() => mul(add(first(), second()), rawTell()));
  const cut = memo(() => mul(add(first(), second()), rawCut()));
  return { n, add, sub, mul, a, c,
    get live() { return live(); }, get dead() { return dead(); },
    get first() { return first(); }, get second() { return second(); },
    get tell() { return tell(); }, get cut() { return cut(); },
    get idle() { return b.unary('sin', mul(read('frame', ['t']), n(1.8))); },
    get moving() { return mul(clamp(read('frame', ['speed'])), sub(n(1), add(first(), second()))); },
    get phase() { return mul(read('frame', ['phase']), n(Math.PI * 2)); },
    get flinch() { return mul(live(), clamp(read('frame', ['flinch']))); },
    sin: (v: number) => b.unary('sin', v), positive: (v: number) => b.binary('max', n(0), v),
    alive: (v: number) => mul(live(), v) };

}

/** New authored motion, never renamed legacy clips. Timings follow the unchanged two real strikes.
 * This candidate owns root recoil; the look disables the second engine-root flinch. Articulation,
 * planted contact and corpse clearance require visual measurement before acceptance. */
export function mantisNativeClips(): {
  group: string; states: string[]; scalars: { name: string; path: string[]; fallback: number }[];
  programs: ReturnType<typeof numericChannelPrograms>;
} {
  const outputs: NumericChannelOutput[] = [];
  const channel = (joint: string, property: 'position' | 'rotation', axis: 'x' | 'y' | 'z', expr: NumericChannelOutput['expr']) => {
    outputs.push({ target: `joint.${joint.replaceAll('_', '.')}`, path: [property, axis], expr });
  };
  channel('body', 'position', 'y', (b, r) => { const e = motion(b, r); return e.add(r('frame', ['dims', 'bodyY']), e.add(e.alive(e.mul(e.n(.008), e.idle)), e.mul(e.n(-.62), e.dead))); });
  channel('body', 'rotation', 'x', (b, r) => { const e = motion(b, r); return e.add(e.alive(e.add(e.mul(e.n(-.04), e.tell), e.mul(e.n(.06), e.cut))), e.mul(e.n(-.12), e.flinch)); });
  channel('body', 'rotation', 'z', (b, r) => { const e = motion(b, r); return e.mul(e.n(.72), e.dead); });
  channel('neck', 'rotation', 'x', (b, r) => { const e = motion(b, r); return e.add(e.alive(e.add(e.mul(e.n(.015), e.idle), e.add(e.mul(e.n(-.10), e.tell), e.mul(e.n(.12), e.cut)))), e.add(e.mul(e.n(-.15), e.flinch), e.mul(e.n(.25), e.dead))); });
  channel('head', 'rotation', 'x', (b, r) => { const e = motion(b, r); return e.add(e.alive(e.mul(e.n(-.02), e.idle)), e.mul(e.n(.30), e.dead)); });
  channel('abdomen', 'rotation', 'x', (b, r) => { const e = motion(b, r); return e.add(e.alive(e.mul(e.n(.018), e.idle)), e.mul(e.n(-.15), e.dead)); });
  for (const side of [-1, 1]) {
    for (const index of [0, 1]) {
      channel(`wing${side}_${index}`, 'rotation', 'z', (b, r) => { const e = motion(b, r); return e.mul(e.n(side), e.add(e.alive(e.add(e.mul(e.n(.025), e.idle), e.mul(e.n(.07), e.tell))), e.mul(e.n(.12), e.dead))); });
      // Diagonal pairs alternate; knees flex only during swing. Tarsi remain knee-weighted.
      const offset = (side === -1 ? index : 1 - index) * Math.PI;
      channel(`leg${side}_${index}`, 'rotation', 'x', (b, r) => { const e = motion(b, r); return e.add(e.alive(e.mul(e.n(.16), e.mul(e.moving, e.sin(e.add(e.phase, e.n(offset)))))), e.mul(e.n(-.18), e.dead)); });
      channel(`leg${side}_${index}_knee`, 'rotation', 'z', (b, r) => { const e = motion(b, r); return e.mul(e.n(side), e.add(e.alive(e.mul(e.n(.18), e.mul(e.moving, e.positive(e.sin(e.add(e.phase, e.n(offset))))))), e.mul(e.n(.38), e.dead))); });
    }
    const limb = `raptor${side}`;
    channel(limb, 'rotation', 'x', (b, r) => { const e = motion(b, r), active = side === -1 ? e.first : e.second, env = side === -1 ? e.a : e.c;
      return e.add(e.alive(e.mul(active, e.add(e.mul(e.n(-.45), env.tell), e.mul(e.n(.65), env.cut)))), e.add(e.mul(e.n(-.10), e.flinch), e.mul(e.n(.45), e.dead))); });
    channel(limb, 'rotation', 'z', (b, r) => { const e = motion(b, r); return e.mul(e.n(side), e.add(e.alive(e.mul(e.n(.08), e.tell)), e.mul(e.n(.32), e.dead))); });
    channel(`${limb}_elbow`, 'rotation', 'x', (b, r) => { const e = motion(b, r), active = side === -1 ? e.first : e.second, env = side === -1 ? e.a : e.c;
      return e.add(e.alive(e.mul(active, e.add(e.mul(e.n(.35), env.tell), e.mul(e.n(-.65), env.cut)))), e.mul(e.n(.4), e.dead)); });
    channel(`${limb}_hook`, 'rotation', 'y', (b, r) => { const e = motion(b, r), active = side === -1 ? e.first : e.second, env = side === -1 ? e.a : e.c;
      return e.mul(e.n(side), e.add(e.alive(e.mul(active, e.mul(e.n(-.32), env.cut))), e.mul(e.n(.15), e.dead))); });
  }
  return { group: 'creature.pose', states: ['stalk', 'attack', 'alert', 'idle'],
    scalars: [{ name: 'clock', path: ['mem', 'regular-clock'], fallback: 0 }, { name: 'stage', path: ['mem', 'mantis-st'], fallback: 0 }],
    programs: outputs.flatMap((row, i) => numericChannelPrograms(`mantis-v7-native.motion1.${i}`, 'creature.pose', [row])),
  };
}
