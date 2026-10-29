import { jsonSlot } from '../saves/slots';
import { isDev } from '../core/devMode';

/**
 * FC11 (MF7b, G896): how often an animal's bones are posed, by its distance from the camera. Every update within 30 m, every
 * 2nd from 30 m, every 4th from 70 m to the animation range (AnimalManager's ANIM_LOD); its root (position, facing) moves
 * every update at every distance, so only the legs' cycle steps (15 / 7.5 Hz at the phone's 30). Settings ▸ Debug ▸
 * Animal pose rate keeps the old every-update pose (A) beside the stepped one (B, shipped).
 */
const FULL = 30, HALF = 70;
export function poseEvery(distanceSquared: number): number {
  if (poseRate() === 'every') return 1;
  return distanceSquared < FULL * FULL ? 1 : distanceSquared < HALF * HALF ? 2 : 4;
}

export const POSE_RATES = ['stepped', 'every'] as const;
export type PoseRate = typeof POSE_RATES[number];
let slot: ReturnType<typeof jsonSlot> | null = null;
let cached: PoseRate | null = null;
const store = (): ReturnType<typeof jsonSlot> => (slot ??= jsonSlot('debug.global.animalPoseRate', 'device'));
/** the Developer pick (Settings ▸ Debug ▸ Animal pose rate); read once, as the manager asks every animal every frame */
export function poseRate(): PoseRate {
  if (!isDev()) return 'stepped';
  if (cached !== null) return cached;
  try { const saved = store().read(); cached = POSE_RATES.find(choice => choice === saved) ?? 'stepped'; } catch { cached = 'stepped'; }
  return cached;
}
export function setPoseRate(pick: PoseRate): void { store().write(pick); cached = pick; }
