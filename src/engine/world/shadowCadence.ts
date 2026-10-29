import { jsonSlot } from '../saves/slots';
import { isDev } from '../core/devMode';

/**
 * BA-3 (MF7 battery, G899 A/B): how often the phone rig redraws its cascades (skyRig.ts). A skipped cascade keeps its last
 * map AND the matrix it was drawn with, so static shadows stay exactly where they were; only a moving caster out there
 * steps. `alternate` (E189): near and middle every drawn frame, far every 2nd (2.5 maps a frame). `staggered`: near
 * every frame, middle every 2nd, far every 4th, never both in one frame (1.75 maps a frame).
 */
export const SHADOW_CADENCES = ['alternate', 'staggered'] as const;
export type ShadowCadence = typeof SHADOW_CADENCES[number];
let slot: ReturnType<typeof jsonSlot> | null = null;
const store = (): ReturnType<typeof jsonSlot> => (slot ??= jsonSlot('debug.global.shadowCadence', 'device'));

/** The Developer pick (Settings ▸ Debug ▸ Shadow cadence); the public build keeps E189's. */
export function shadowCadence(): ShadowCadence {
  if (!isDev()) return 'alternate';
  try { const saved = store().read(); return SHADOW_CADENCES.find(choice => choice === saved) ?? 'alternate'; } catch { return 'alternate'; }
}
export function setShadowCadence(pick: ShadowCadence): void { store().write(pick); }

/** Which of a phone rig's `count` cascades redraw on drawn frame `tick`: `[near, middle, far]` for three. */
export function cascadeRedraws(cadence: ShadowCadence, tick: number, count: number): boolean[] {
  const redraw = Array.from({ length: count }, () => true);
  if (count < 2) return redraw;
  if (cadence === 'alternate') { redraw[count - 1] = tick % 2 === 0; return redraw; }
  // staggered: the far one on tick 0 of 4, the middle one on the odd ticks
  redraw[count - 1] = tick % 4 === 0;
  if (count >= 3) redraw[count - 2] = tick % 2 === 1;
  return redraw;
}
