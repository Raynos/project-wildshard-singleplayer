import { numericChannelPrograms, type ClientChannels, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';

export type PufferPreviewPose = 'rest' | 'inflate-105' | 'inflate-110' | 'attack';
export const PUFFER_PREVIEW_POSES: readonly PufferPreviewPose[] = ['rest', 'inflate-105', 'inflate-110', 'attack'];

interface PufferNativePose {
  group: string;
  states: string[];
  scalars: { name: string; path: string[]; fallback: number }[];
  programs: ReturnType<typeof numericChannelPrograms>;
}

/** Native rig diagnostic only. Names resolve against the exported bone table (head is index 7 in V23).
 * No independent head channels: its local bind translation and identity rotation/scale inherit belly inflation.
 * The existing 2.1-second strike clock is retained; inflation is deliberately capped at 1.10 pending review.
 * Rest diagnostics do not pretend to freeze the arena simulation, camera, sky or post processing. */
export function pufferNativeClips(mode: PufferPreviewPose): PufferNativePose {
  if (!PUFFER_PREVIEW_POSES.includes(mode)) throw new Error('Unknown Puffer preview pose');
  const outputs: NumericChannelOutput[] = (['x', 'y', 'z'] as const).map(axis => ({
    target: 'joint.belly', path: ['scale', axis], expr: (b, read) => {
      if (mode !== 'attack') return b.constant(mode === 'inflate-110' ? 1.10 : mode === 'inflate-105' ? 1.05 : 1);
      const c = (value: number) => b.constant(value);
      const clock = read('scalars', ['clock']), stage = read('scalars', ['stage']);
      const phase = (lo: number, hi: number) => b.binary('max', c(0), b.binary('min', c(1),
        b.binary('div', b.binary('sub', b.binary('div', clock, c(2.1)), c(lo)), c(hi - lo))));
      const swell = b.binary('mul', phase(0, .39), b.binary('sub', c(1), phase(.43, .61)));
      const active = b.binary('mul', b.binary('gt', stage, c(.5)), b.binary('gt', c(1.5), stage));
      return b.binary('add', c(1), b.select(active, b.binary('mul', c(.10), swell), c(0)));
    },
  }));
  if (mode === 'attack') {
    type Read = Parameters<NumericChannelOutput['expr']>[1];
    const motion = (b: ClientChannels, read: Read) => {
      const n = (v: number) => b.constant(v);
      const add = (a: number, v: number) => b.binary('add', a, v);
      const mul = (a: number, v: number) => b.binary('mul', a, v);
      const sub = (a: number, v: number) => b.binary('sub', a, v);
      const clamp = (v: number) => b.binary('max', n(0), b.binary('min', n(1), v));
      const dead = clamp(read('frame', ['deathT'])), live = sub(n(1), dead);
      const clock = read('scalars', ['clock']), stage = read('scalars', ['stage']);
      const active = mul(b.binary('gt', stage, n(.5)), b.binary('gt', n(1.5), stage));
      const ramp = (lo: number, hi: number) => clamp(b.binary('div', sub(clock, n(lo)), n(hi - lo)));
      const tell = mul(active, mul(ramp(0, .82), sub(n(1), ramp(.9, 1.12))));
      const burst = mul(active, mul(ramp(.9, 1.0), sub(n(1), ramp(1.0, 1.42))));
      const walk = mul(b.unary('sin', mul(read('frame', ['phase']), n(Math.PI * 2))), clamp(read('frame', ['speed'])));
      const idle = b.unary('sin', mul(read('frame', ['t']), n(2.4)));
      return { n, add, mul, sub, dead, live, tell, burst, walk, idle, flinch: read('frame', ['flinch']) };
    };
    const channel = (bone: string, property: 'position' | 'rotation' | 'scale', axis: 'x' | 'y' | 'z', expr: NumericChannelOutput['expr']) => {
      outputs.push({ target: `joint.${bone}`, path: [property, axis], expr });
    };
    // Native bind height is measured input, never the legacy .43 offset. Head stays bind-local.
    channel('body', 'position', 'y', (b, r) => { const e = motion(b, r); return e.add(e.add(r('frame', ['dims', 'bodyY']), e.mul(e.live, e.add(e.mul(e.n(.015), e.add(e.n(1), e.idle)), e.add(e.mul(e.n(.10), e.flinch), e.add(e.mul(e.n(.03), e.tell), e.mul(e.n(.06), e.burst)))))), e.mul(e.n(.09), e.dead)); });
    channel('body', 'rotation', 'x', (b, r) => { const e = motion(b, r); return e.mul(e.live, e.add(e.mul(e.n(-.08), e.flinch), e.add(e.mul(e.n(-.035), e.tell), e.mul(e.n(.08), e.burst)))); });
    channel('body', 'rotation', 'z', (b, r) => { const e = motion(b, r); return e.mul(e.n(.35), e.dead); });
    channel('body', 'scale', 'y', (b, r) => { const e = motion(b, r); return e.sub(e.n(1), e.mul(e.n(.40), e.dead)); });
    for (const [bone, sign] of [['finL', 1], ['finR', -1], ['rearL', -1], ['rearR', 1]] as const) {
      channel(bone, 'rotation', 'x', (b, r) => { const e = motion(b, r); return e.mul(e.live, e.mul(e.sub(e.n(1), e.tell), e.mul(e.n(-.18), b.binary('max', e.n(0), e.mul(e.n(sign), e.walk))))); });
      channel(bone, 'rotation', 'y', (b, r) => { const e = motion(b, r); const side = bone.endsWith('L') ? 1 : -1; return e.mul(e.live, e.mul(e.n(side), e.add(e.mul(e.n(.03), e.idle), e.add(e.mul(e.n(.07), e.tell), e.mul(e.n(-.08), e.burst))))); });
    }
    // Brief brace and release use the same authoritative strike clock; no swell/timing increase.
    channel('tail', 'rotation', 'x', (b, r) => { const e = motion(b, r); return e.mul(e.live, e.mul(e.n(-.18), e.burst)); });
    channel('tail', 'rotation', 'y', (b, r) => { const e = motion(b, r); return e.mul(e.live, e.add(e.mul(e.n(.22), e.idle), e.mul(e.n(.24), e.walk))); });
  }
  return { group: 'creature.pose', states: ['stalk', 'attack', 'alert'],
    scalars: [{ name: 'clock', path: ['mem', 'regular-clock'], fallback: 0 }, { name: 'stage', path: ['mem', 'puffer-st'], fallback: 0 }],
    programs: outputs.flatMap((row, i) => numericChannelPrograms(`puffer-native-preview.${mode}.${i}`, 'creature.pose', [row])),
  };
}
