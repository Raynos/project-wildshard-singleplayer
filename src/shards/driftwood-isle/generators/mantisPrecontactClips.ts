import { numericChannelPrograms, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';

type Read = Parameters<NumericChannelOutput['expr']>[1];
type Builder = Parameters<NumericChannelOutput['expr']>[0];

/** V7's exact 22-joint rig. Source underscores are encoded as dots by the existing pose binder. */
export const MANTIS_NATIVE_JOINTS = ['body', 'neck', 'head', 'abdomen',
  ...[-1, 1].flatMap(side => [`wing${side}_0`, `wing${side}_1`, `leg${side}_0`, `leg${side}_0_knee`,
    `leg${side}_1`, `leg${side}_1_knee`, `raptor${side}`, `raptor${side}_elbow`, `raptor${side}_hook`])];

function motion(b: Builder, read: Read) {
  const constants = new Map<number, number>();
  const n = (v: number) => { const old = constants.get(v); if (old !== undefined) return old; const id = b.constant(v); constants.set(v, id); return id; };
  const add = (a: number, c: number) => b.binary('add', a, c);
  const sub = (a: number, c: number) => b.binary('sub', a, c), mul = (a: number, c: number) => b.binary('mul', a, c);
  const clamp = (a: number) => b.binary('max', n(0), b.binary('min', n(1), a));
  const smooth = (a: number) => { const t = clamp(a); return mul(mul(t, t), sub(n(3), mul(n(2), t))); };
  // Build only the channels used by this output; the evaluator deliberately caps each DAG at 128 nodes.
  const memo = <T>(make: () => T): (() => T) => { let value: { result: T } | undefined; return () => { value ??= { result: make() }; return value.result; }; };
  const clock = memo(() => read('scalars', ['phaseClock'])), stage = memo(() => read('scalars', ['stage']));
  const phase = memo(() => read('scalars', ['strikePhase']));
  const kneeDead = memo(() => smooth(mul(read('frame', ['deathT']), n(2.5))));
  const dead = memo(() => smooth(read('frame', ['deathT']))), live = memo(() => sub(n(1), dead()));
  const equal = (input: number, value: number) => mul(b.binary('gt', input, n(value - .5)), b.binary('gt', n(value + .5), input));
  const first = memo(() => equal(stage(), 1)), second = memo(() => equal(stage(), 3));
  const wind = memo(() => equal(phase(), 1)), active = memo(() => equal(phase(), 2)), recover = memo(() => equal(phase(), 3));
  const ramp = (duration: number) => smooth(b.binary('div', clock(), duration));
  const recovery = memo(() => b.select(first(), n(.12), n(1.1)));
  // frame.attack is the normalized authoritative windup, or -1 after cancelAttack.
  // It wins over the 10 Hz observer, including a stale prior-strike recovery.
  const attack = memo(() => read('frame', ['attack']));
  const cancelled = memo(() => b.binary('gt', n(0), attack()));
  const rise = memo(() => smooth(b.binary('div', attack(), n(.30))));
  const sweep = memo(() => smooth(b.binary('div', sub(attack(), n(.45)), n(.50))));
  const rawTell = memo(() => b.select(cancelled(), n(0), mul(rise(), sub(n(1), sweep()))));
  // cancelAttack can precede the observer's active state within the same tick.
  const heldCut = memo(() => add(add(wind(), active()), mul(recover(), sub(n(1), ramp(recovery())))));
  const rawCut = memo(() => b.select(cancelled(), heldCut(), sweep()));
  const a = { get tell() { return rawTell(); }, get cut() { return rawCut(); } }, c = a;
  const tell = memo(() => mul(add(first(), second()), rawTell()));
  const cut = memo(() => mul(add(first(), second()), rawCut()));
  return { n, add, sub, mul, a, c,
    get live() { return live(); }, get dead() { return dead(); },
    // Knee-only 0.32 s tuck/settle, before the unchanged 0.8 s body/hip collapse.
    get kneeDead() { return kneeDead(); },
    get first() { return first(); }, get second() { return second(); },
    get tell() { return tell(); }, get cut() { return cut(); },
    get attackLift() { return mul(add(first(), second()), add(rawTell(), rawCut())); },
    get idle() { return b.unary('sin', mul(read('frame', ['t']), n(1.8))); },
    get moving() { return mul(clamp(read('frame', ['speed'])), sub(n(1), add(first(), second()))); },
    get phase() { return mul(read('frame', ['phase']), n(Math.PI * 2)); },
    get flinch() { return mul(live(), clamp(read('frame', ['flinch']))); },
    sin: (v: number) => b.unary('sin', v), positive: (v: number) => b.binary('max', n(0), v),
    alive: (v: number) => mul(live(), v) };

}

/** Candidate7 source study: continuous authoritative precontact sweep.
 * Raise 0-.30, hold .30-.45, sweep .45-.95, hold endpoint .95-1.
 * Actual combat windups remain .75/.45 seconds; active remains a held endpoint.
 * Recovery still follows the 10 Hz observation and may stair-step. No history,
 * previous-joint reads, combat changes or continuous-contact acceptance. */
export function mantisPrecontactClips(): {
  group: string; states: string[]; scalars: { name: string; path: string[]; fallback: number }[];
  programs: ReturnType<typeof numericChannelPrograms>;
} {
  const outputs: NumericChannelOutput[] = [];
  const channel = (joint: string, property: 'position' | 'rotation', axis: 'x' | 'y' | 'z', expr: NumericChannelOutput['expr']) => {
    outputs.push({ target: `joint.${joint.replaceAll('_', '.')}`, path: [property, axis], expr });
  };
  channel('body', 'position', 'y', (b, r) => { const e = motion(b, r); return e.add(r('frame', ['dims', 'bodyY']), e.add(e.alive(e.add(e.mul(e.n(.008), e.idle), e.add(e.mul(e.n(.075), e.attackLift), e.mul(e.n(.02), e.mul(e.moving, b.unary('abs', e.sin(e.phase))))))), e.add(e.mul(e.n(-.80), e.dead), e.mul(e.n(.09), e.flinch)))); });
  channel('body', 'rotation', 'x', (b, r) => { const e = motion(b, r); return e.add(e.alive(e.add(e.mul(e.n(-.04), e.tell), e.mul(e.n(.06), e.cut))), e.mul(e.n(-.12), e.flinch)); });
  channel('body', 'rotation', 'z', (b, r) => { const e = motion(b, r); return e.mul(e.n(.40), e.dead); });
  channel('neck', 'rotation', 'x', (b, r) => { const e = motion(b, r); return e.add(e.alive(e.add(e.mul(e.n(.015), e.idle), e.add(e.mul(e.n(-.10), e.tell), e.mul(e.n(.12), e.cut)))), e.add(e.mul(e.n(-.15), e.flinch), e.mul(e.n(.25), e.dead))); });
  channel('head', 'rotation', 'x', (b, r) => { const e = motion(b, r); return e.add(e.alive(e.mul(e.n(-.02), e.idle)), e.mul(e.n(.30), e.dead)); });
  channel('abdomen', 'rotation', 'x', (b, r) => { const e = motion(b, r); return e.add(e.alive(e.mul(e.n(.018), e.idle)), e.mul(e.n(.05), e.dead)); });
  for (const side of [-1, 1]) {
    for (const index of [0, 1]) {
      channel(`wing${side}_${index}`, 'rotation', 'z', (b, r) => { const e = motion(b, r); return e.mul(e.n(side), e.add(e.alive(e.add(e.mul(e.n(.025), e.idle), e.mul(e.n(.07), e.tell))), e.mul(e.n(.12), e.dead))); });
      // Diagonal pairs alternate; knees flex only during swing. Tarsi remain knee-weighted.
      const offset = (side === -1 ? index : 1 - index) * Math.PI;
      channel(`leg${side}_${index}`, 'rotation', 'x', (b, r) => { const e = motion(b, r); return e.add(e.alive(e.mul(e.n(.08), e.mul(e.moving, e.sin(e.add(e.phase, e.n(offset)))))), e.mul(e.n(-.18), e.dead)); });
      channel(`leg${side}_${index}`, 'rotation', 'z', (b, r) => { const e = motion(b, r); return e.mul(e.n(side * 1.4), e.dead); });
      channel(`leg${side}_${index}_knee`, 'rotation', 'z', (b, r) => { const e = motion(b, r); return e.mul(e.n(side), e.add(e.alive(e.mul(e.n(.09), e.mul(e.moving, e.positive(e.sin(e.add(e.phase, e.n(offset))))))), e.add(e.mul(e.n(.38), e.kneeDead), e.mul(e.n(2), e.mul(e.kneeDead, e.sub(e.n(1), e.kneeDead)))))); });
    }
    const limb = `raptor${side}`;
    channel(limb, 'rotation', 'x', (b, r) => { const e = motion(b, r), active = side === -1 ? e.first : e.second, env = side === -1 ? e.a : e.c;
      return e.add(e.alive(e.mul(active, e.add(e.mul(e.n(-.45), env.tell), e.mul(e.n(.65), env.cut)))), e.add(e.mul(e.n(-.10), e.flinch), e.mul(e.n(.45), e.dead))); });
    channel(limb, 'rotation', 'z', (b, r) => { const e = motion(b, r); return e.mul(e.n(side), e.add(e.alive(e.mul(e.n(.08), e.tell)), e.mul(e.n(1.4), e.dead))); });
    channel(`${limb}_elbow`, 'rotation', 'x', (b, r) => { const e = motion(b, r), active = side === -1 ? e.first : e.second, env = side === -1 ? e.a : e.c;
      return e.add(e.alive(e.mul(active, e.add(e.mul(e.n(.35), env.tell), e.mul(e.n(-.65), env.cut)))), e.mul(e.n(.8), e.dead)); });
    channel(`${limb}_hook`, 'rotation', 'y', (b, r) => { const e = motion(b, r), active = side === -1 ? e.first : e.second, env = side === -1 ? e.a : e.c;
      return e.mul(e.n(side), e.add(e.alive(e.mul(active, e.mul(e.n(-.32), env.cut))), e.mul(e.n(.15), e.dead))); });
  }
  return { group: 'creature.pose', states: ['stalk', 'attack', 'alert', 'idle'],
    scalars: [{ name: 'phaseClock', path: ['mem', 'mantis-pose-clock'], fallback: 0 }, { name: 'strikePhase', path: ['mem', 'mantis-pose-phase'], fallback: 0 }, { name: 'stage', path: ['mem', 'mantis-st'], fallback: 0 }],
    programs: outputs.flatMap((row, i) => numericChannelPrograms(`mantis-v7-native.motion7.${i}`, 'creature.pose', [row])),
  };
}
