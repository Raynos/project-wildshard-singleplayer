import { numericChannelPrograms, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';
import { pufferNativeClips } from './pufferNativeClips';

/** Isolated rig1 trial. Calibrates the existing walk phase, not displacement-integrated planting. */
export const PUFFER_GAIT4_STROKE = .24;
export const PUFFER_GAIT4_STANCE = .62;
export const PUFFER_GAIT4_LEG_LEN = PUFFER_GAIT4_STROKE / (2 * Math.sin(.36));
export const PUFFER_GAIT4_MIN_SPEED = .6 * PUFFER_GAIT4_STROKE / PUFFER_GAIT4_STANCE;
const feet = [['finL', 0, .16], ['finR', .5, .16], ['rearL', .5, -.36], ['rearR', 0, -.36]] as const;

export function pufferNativeGait4Clips(): ReturnType<typeof pufferNativeClips> {
  const base = pufferNativeClips('attack');
  const targets = new Set(feet.map(([name]) => `joint.${name}`));
  const outputs: NumericChannelOutput[] = [];
  for (const [name, offset, bindZ] of feet) {
    const values = (b: Parameters<NumericChannelOutput['expr']>[0], read: Parameters<NumericChannelOutput['expr']>[1]) => {
      const constants = new Map<number, number>();
      const n = (v: number) => { const prior = constants.get(v); if (prior !== undefined) return prior; const node = b.constant(v); constants.set(v, node); return node; };
      const add = (a: number, c: number) => b.binary('add', a, c);
      const sub = (a: number, c: number) => b.binary('sub', a, c);
      const mul = (a: number, c: number) => b.binary('mul', a, c);
      const clamp = (v: number) => b.binary('max', n(0), b.binary('min', n(1), v));
      const div = (a: number, c: number) => b.binary('div', a, c);
      const phase = b.binary('mod', add(read('frame', ['phase']), n(offset)), n(1));
      const swing = clamp(div(sub(phase, n(PUFFER_GAIT4_STANCE)), n(1 - PUFFER_GAIT4_STANCE)));
      const smooth = mul(mul(swing, swing), sub(n(3), mul(n(2), swing)));
      const forward = b.select(b.binary('gt', phase, n(PUFFER_GAIT4_STANCE)),
        add(n(-.12), mul(n(.24), smooth)), sub(n(.12), mul(n(.24), div(phase, n(PUFFER_GAIT4_STANCE)))));
      const stage = read('scalars', ['stage']), clock = read('scalars', ['clock']);
      const active = mul(b.binary('gt', stage, n(.5)), b.binary('gt', n(1.5), stage));
      const ramp = (lo: number, hi: number) => clamp(div(sub(clock, n(lo)), n(hi - lo)));
      const tell = mul(active, mul(ramp(0, .82), sub(n(1), ramp(.9, 1.12))));
      const burst = mul(active, mul(ramp(.9, 1), sub(n(1), ramp(1, 1.42))));
      // Existing speed supplies the stop fade; no private timer/continuation is smuggled into numeric poses.
      const speed = b.unary('abs', read('frame', ['speed']));
      const move = clamp(div(speed, n(PUFFER_GAIT4_MIN_SPEED)));
      const live = sub(n(1), clamp(read('frame', ['deathT'])));
      const gait = mul(live, mul(move, mul(sub(n(1), clamp(div(read('frame', ['flinch']), n(.3)))),
        b.select(active, sub(n(1), ramp(0, .22)), b.select(b.binary('gt', stage, n(1.5)), n(0), n(1))))));
      const idle = b.unary('sin', mul(read('frame', ['t']), n(2.4)));
      return { n, add, sub, mul, live, gait, forward, swing, idle, tell, burst };
    };
    const channel = (property: 'position' | 'rotation', axis: 'x' | 'y' | 'z', expr: NumericChannelOutput['expr']) => {
      outputs.push({ target: `joint.${name}`, path: [property, axis], expr });
    };
    channel('position', 'z', (b, r) => { const e = values(b, r); return e.add(e.n(bindZ), e.mul(e.gait, e.forward)); });
    channel('position', 'y', (b, r) => {
      const e = values(b, r), lift = e.mul(e.n(.06), b.unary('sin', e.mul(e.n(Math.PI), e.swing)));
      const bob = e.mul(e.n(.015), e.add(e.n(1), e.idle));
      return e.add(e.sub(e.n(.5), r('frame', ['dims', 'bodyY'])), e.mul(e.gait, e.sub(lift, bob)));
    });
    channel('rotation', 'x', b => b.constant(0));
    channel('rotation', 'y', (b, r) => { const e = values(b, r); return e.mul(e.live, e.mul(e.sub(e.n(1), e.gait),
      e.mul(e.n(name.endsWith('L') ? 1 : -1), e.add(e.mul(e.n(.03), e.idle), e.add(e.mul(e.n(.07), e.tell), e.mul(e.n(-.08), e.burst)))))); });
  }
  return { ...base, programs: [...base.programs.filter(program => !program.numeric?.outputs.some(output => targets.has(output.target))),
    ...outputs.flatMap((output, i) => numericChannelPrograms(`puffer-native-preview.gait4.${i}`, 'creature.pose', [output]))] };
}
