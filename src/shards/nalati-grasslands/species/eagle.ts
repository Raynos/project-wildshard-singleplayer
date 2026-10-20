import type { RigAnimCtx } from '@wildshard/engine/entities/species/registry';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { poseNalatiCreature } from './presentation';

/**
 * Golden eagle (Nalati named elite E3, Qyran the Storm-Wing; row B12). Its body, pose programme and elite controls are
 * rows (data/speciesLooks.json); the flight altitude stays here: the elite's brain writes `animal.mem.altY` (absolute
 * world y of the body) and the body follows it, smoothed, before the pose (`flap`, `fold`, `bank`, `ground` in mem).
 */
export function animateEagle(c: RigAnimCtx): void {
  const m = c.mem, a = c.animal, ground = heightAt(a.position.x, a.position.z), alt = m['altY'] ?? ground + 20;
  m['altS'] = (m['altS'] ?? alt) + (alt - (m['altS'] ?? alt)) * Math.min(1, c.dt * 6);
  a.yOffset = (m['altS'] ?? alt) - ground;
  poseNalatiCreature('eagle', c);
}
