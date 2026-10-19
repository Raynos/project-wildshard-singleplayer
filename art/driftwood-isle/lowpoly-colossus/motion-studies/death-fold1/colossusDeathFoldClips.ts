import { numericChannelPrograms, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';

type Read = Parameters<NumericChannelOutput['expr']>[1];
type Builder = Parameters<NumericChannelOutput['expr']>[0];
export const COLOSSUS_NATIVE_JOINTS = ['body', 'head', ...[-1, 1].flatMap(side =>
  ['arm', 'forearm', 'hand', 'outer', 'middle', 'inner', 'thumb', 'leg', 'shin', 'foot'].map(name => `${name}${side}`))];
function motion(b: Builder, read: Read) {
  const constants = new Map<number, number>();
  const n = (value: number) => { const old = constants.get(value); if (old !== undefined) return old; const id = b.constant(value); constants.set(value, id); return id; };
  const add = (a: number, c: number) => b.binary('add', a, c), sub = (a: number, c: number) => b.binary('sub', a, c);
  const mul = (a: number, c: number) => b.binary('mul', a, c);
  const clamp = (a: number) => b.binary('max', n(0), b.binary('min', n(1), a));
  const memo = <T>(make: () => T): (() => T) => { let value: { result: T } | undefined; return () => { value ??= { result: make() }; return value.result; }; };
  const dead = memo(() => clamp(read('frame', ['deathT']))), live = memo(() => sub(n(1), dead()));
  const stage = memo(() => read('scalars', ['step'])), clock = memo(() => read('scalars', ['clock']));
  const equal = (value: number) => b.binary('gt', n(.5), b.unary('abs', sub(stage(), n(value))));
  const ramp = (start: number, end: number) => clamp(b.binary('div', sub(clock(), n(start)), n(end - start)));
  // Existing Colossus strikes are time-driven (no motion descriptor). Preserve their complete active windows.
  const env = (state: number, wind: number, active: number, recovery: number) => ({
    tell: () => mul(equal(state), mul(ramp(0, wind * .8), sub(n(1), ramp(wind, wind + active * .6)))),
    hit: () => mul(equal(state), mul(ramp(wind, wind + active * .6), sub(n(1), ramp(wind + active, wind + active + recovery)))),
  });
  // Piecewise smoothstep windows use only the existing normalized 0.8 s death clock.
  const progress = (start: number, end: number) => {
    const u = clamp(b.binary('div', sub(dead(), n(start)), n(end - start)));
    return mul(mul(u, u), sub(n(3), mul(n(2), u)));
  };
  const deathPose = (brace: number, rest: number) => add(mul(n(brace), progress(0, .38)), mul(n(rest - brace), progress(.38, 1)));
  return { n, add, sub, mul, equal, env, progress, deathPose,
    get dead() { return dead(); }, alive: (value: number) => mul(live(), value),
    idle: () => mul(live(), b.unary('sin', mul(read('frame', ['t']), n(1.3)))),
    flinch: () => mul(live(), clamp(read('frame', ['flinch']))),
  };
}
/** Death-fold1 SOURCE STUDY ONLY, not admitted or visually accepted.
 * Existing native22 anatomy. Buckle, asymmetric arm brace, torso fold, then held rest.
 * Body descent is an authored bone transform; it does NOT move/resize the rigid box.
 * Preserve exact motion2 living formulas, gameplay scalars and attack windows.
 * Known boundary: onDeath clears attack state/clock, so active-lethal continuity is
 * not recoverable from these stateless numeric inputs. Tests retain that failure. */
export function colossusNativeClips(): { group: string; states: string[]; scalars: { name: string; path: string[]; fallback: number }[]; programs: ReturnType<typeof numericChannelPrograms> } {
  const outputs: NumericChannelOutput[] = [];
  const channel = (joint: string, axis: 'x' | 'y' | 'z', expr: NumericChannelOutput['expr']) => outputs.push({ target: `joint.${joint}`, path: ['rotation', axis], expr });
  outputs.push({ target: 'joint.body', path: ['position', 'y'], expr: (b, r) => { const e = motion(b, r); return e.sub(r('frame', ['dims', 'bodyY']), e.mul(e.n(1.38), e.progress(.28, 1))); } });
  channel('body', 'x', (b, r) => { const e = motion(b, r); return e.mul(e.n(1.35), e.progress(.20, .90)); });
  channel('body', 'z', (b, r) => { const e = motion(b, r); return e.mul(e.n(-.12), e.progress(.45, 1)); });
  channel('body', 'y', (b, r) => { const e = motion(b, r); return e.mul(e.n(.008), e.idle()); });
  channel('head', 'x', (b, r) => { const e = motion(b, r); return e.add(e.mul(e.n(.025), e.idle()), e.add(e.mul(e.n(-.12), e.flinch()), e.deathPose(.48, .24))); });
  for (const side of [-1, 1]) {
    const attack = (b: Builder, r: Read) => { const e = motion(b, r), sweep = e.env(side === -1 ? 1 : 2, .9, .25, .35), slam = e.env(3, 1.1, .18, 1.5); return { e, sweep, slam }; };
    channel(`arm${side}`, 'x', (b, r) => { const { e, sweep, slam } = attack(b, r); return e.add(e.alive(e.add(e.mul(e.n(-.55), sweep.tell()), e.add(e.mul(e.n(-.30), sweep.hit()), e.add(e.mul(e.n(-1.10), slam.tell()), e.mul(e.n(-.45), slam.hit()))))), e.deathPose(-.85, side === -1 ? -.45 : -.65)); });
    channel(`arm${side}`, 'z', (b, r) => { const { e, sweep } = attack(b, r); return e.mul(e.n(side), e.add(e.alive(e.add(e.mul(e.n(.32), sweep.tell()), e.mul(e.n(-.12), sweep.hit()))), e.deathPose(.32, side === -1 ? .16 : .08))); });
    channel(`forearm${side}`, 'x', (b, r) => { const { e, sweep, slam } = attack(b, r); return e.add(e.alive(e.add(e.mul(e.n(-.30), sweep.tell()), e.mul(e.n(-.35), slam.tell()))), e.add(e.mul(e.n(-.05), e.flinch()), e.deathPose(-1.05, side === -1 ? -.22 : -.36))); });
    channel(`hand${side}`, 'y', (b, r) => { const { e, sweep, slam } = attack(b, r); return e.mul(e.n(side), e.add(e.alive(e.add(e.mul(e.n(.18), sweep.hit()), e.mul(e.n(.08), slam.tell()))), e.deathPose(.16, .08))); });
    for (const [index, digit] of ['outer', 'middle', 'inner', 'thumb'].entries()) channel(`${digit}${side}`, 'x', (b, r) => { const { e, sweep, slam } = attack(b, r); return e.add(e.mul(e.n(.008 + index * .002), e.idle()), e.add(e.alive(e.mul(e.n(-.06), e.add(sweep.tell(), slam.tell()))), e.deathPose(-.18, -.06))); });
    // Buckle precedes torso descent; the right knee remains more folded in the held silhouette.
    for (const [name, angle] of [['leg', -.95], ['shin', 1.35], ['foot', -.40]] as const)
      channel(`${name}${side}`, 'x', (b, r) => { const e = motion(b, r); const rest = name === 'leg' ? (side === -1 ? -.65 : -.90) : name === 'shin' ? (side === -1 ? 1.15 : 1.50) : (side === -1 ? -.50 : -.60); return e.deathPose(angle, rest); });
    for (const [index, name] of ['leg', 'shin', 'foot'].entries()) channel(`${name}${side}`, 'y', (b, r) => { const e = motion(b, r); return e.mul(e.n(side * (index === 1 ? -.006 : .003)), e.add(e.idle(), e.dead)); });
  }
  return { group: 'creature.pose', states: ['idle', 'stalk', 'attack', 'alert'], scalars: [
    { name: 'step', path: ['mem', 'tg-state'], fallback: 0 }, { name: 'clock', path: ['mem', 'tg-clock'], fallback: 0 }],
    programs: outputs.flatMap((row, i) => numericChannelPrograms(`colossus-v4-skin1.death-fold1.${i}`, 'creature.pose', [row])) };
}
