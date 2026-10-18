import { numericChannelPrograms, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';

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
  return { group: 'creature.pose', states: ['stalk', 'attack', 'alert'],
    scalars: [{ name: 'clock', path: ['mem', 'regular-clock'], fallback: 0 }, { name: 'stage', path: ['mem', 'puffer-st'], fallback: 0 }],
    programs: outputs.flatMap((row, i) => numericChannelPrograms(`puffer-native-preview.${mode}.${i}`, 'creature.pose', [row])),
  };
}
