import { jsonSlot } from '../saves/slots';
import { isDev } from '../core/devMode';

/**
 * BA-3 (MF7 battery; G899, the staggered cadence won its A / B: Driftwood phone 203 -> 180 draw calls a frame, shadow maps
 * -30 %, no visible swim on a turning clip): which of the phone rig's cascades redraw on drawn frame `tick` (skyRig.ts).
 * The near one every frame (the player's own shadow), the middle every 2nd, the far every 4th, never both in one frame:
 * 1.75 maps a frame, from E189's 2.5. A skipped cascade keeps its map AND the matrix it was drawn with, so static shadows
 * stay exactly where they were; only a moving caster beyond 7 m steps (15 / 7.5 Hz at the phone's 30).
 */
export function cascadeRedraws(tick: number, count: number): boolean[] {
  const redraw = Array.from({ length: count }, () => true);
  if (count < 2) return redraw;
  redraw[count - 1] = tick % 4 === 0;
  if (count >= 3) redraw[count - 2] = tick % 2 === 1;
  return redraw;
}

/**
 * FC13 (G912, MF7b): while the view stands still the cascades' frusta do not move, so a redraw only steps a moving caster.
 * Settings ▸ Debug ▸ Idle frames (default off) then halves the cadence again: the near cascade every 2nd drawn frame, the
 * middle every 4th, the far every 8th, never two in one frame (0.875 maps a frame, from 1.75). The first moved frame goes
 * back to `cascadeRedraws`.
 */
export function stillRedraws(tick: number, count: number): boolean[] {
  const redraw = Array.from({ length: count }, () => true);
  if (count < 2) return redraw;
  redraw[0] = tick % 2 === 0;
  redraw[count - 1] = tick % 8 === 3;
  if (count >= 3) redraw[count - 2] = tick % 4 === 1;
  return redraw;
}

export const IDLE_FRAMES = ['off', 'hold'] as const;
export type IdleFrames = typeof IDLE_FRAMES[number];
let slot: ReturnType<typeof jsonSlot> | null = null;
const store = (): ReturnType<typeof jsonSlot> => (slot ??= jsonSlot('debug.global.idleFrames', 'device'));
/** the Developer pick (Settings ▸ Debug ▸ Idle frames); the public build keeps every frame's cadence */
export function idleFrames(): IdleFrames {
  if (!isDev()) return 'off';
  try { const saved = store().read(); return IDLE_FRAMES.find(choice => choice === saved) ?? 'off'; } catch { return 'off'; }
}
export function setIdleFrames(pick: IdleFrames): void { store().write(pick); }
