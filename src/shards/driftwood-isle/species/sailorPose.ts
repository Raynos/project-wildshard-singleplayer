import { MathUtils } from 'three';
import type { AnimalRigContext, AnimalRigJoint } from '@wildshard/engine/entities/animalRig';
import { bump, clamp, lookAngles, smooth01, squashBody, step } from '@wildshard/engine/entities/species/rigs';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { SailorMem } from './sailor';

type Side = 'L' | 'R';
type SailorBones = Record<'body' | 'spine' | 'chest' | 'head' | `arm${Side}_${'sh' | 'el' | 'hand'}` | `leg${Side}_${'hip' | 'knee' | 'foot'}`, AnimalRigJoint>;
const L = MathUtils.lerp;
const RISE_T = 1.5;
export function stepSailorRise(a: Pick<AnimalSim, 'mem' | 'yOffset'>, dt: number): number {
  const m = a.mem as SailorMem;
  if (m.rising) { m.rise = Math.min(1, (m.rise || 0) + dt / RISE_T); if (m.rise >= 1) m.rising = 0; }
  if (m.sinking) { m.rise = Math.max(0, (m.rise || 0) - dt / RISE_T); if (m.rise <= 0) m.sinking = 0; }
  const up = m.init ? smooth01(m.rise || 0) : 0;
  const floor = m.floor || 0;
  m.floorS = (m.floorS ?? floor) + (floor - (m.floorS ?? floor)) * Math.min(1, dt * 6);   // the deck under it, smoothed (it steps off the heeled deck onto the sand)
  a.yOffset = L(m.floorS - 2.3, m.floorS, up);
  return up;
}
const R = (b: AnimalRigJoint,x:number,y:number,z:number) => b.rotation.set(x,y,z);

export function animateSailor(c: AnimalRigContext): void {
  const b = c.bones as SailorBones, t = c.t, seed = c.seed, a = c.animal, dt = c.dt;
  // ── rising / sinking through the deck (per frame, smooth): mem.rise 0 (under) → 1 (standing) ──
  const up = stepSailorRise(a, dt);
  const rise = 1 - up;
  const dead = c.deathT >= 0 ? smooth01(c.deathT) : 0;
  const moving = clamp(c.speed / 0.8, 0, 1);
  const ph = c.phase * Math.PI * 2;
  const atk = c.attack;
  const look = lookAngles(c, 1.6, 0.9, 0.5);
  const sway = Math.sin(t * 0.8 + seed * 4);
  // ── body: hunched, lurching with the shamble; dies to its knees then face down ──
  const kneel = step(dead, 0, 0.5), topple = step(dead, 0.45, 1);
  b.body.position.y = c.dims.bodyY - 0.06 - 0.04 * Math.abs(Math.sin(ph)) * moving - 0.08 * c.brace - 0.42 * kneel - 0.25 * topple + 0.02 * sway * (1 - moving);
  let bodyP = 0.28 + 0.1 * moving + 0.15 * c.brace - 0.35 * rise + 1.35 * topple;
  let spineY = 0.06 * sway, headP = -0.15 + 0.2 * c.flinch + 0.25 * kneel + 0.3 * topple;
  const headZ = 0.15 * Math.sin(t * 0.6 + seed);
  // ── the cutlass swing: wind up over the head (0 → 0.62), the cut (0.62 → 0.78), recover ──
  let swX = 0.2, swZ = -0.25, elR = -0.5;
  const swY = 0;
  if (atk >= 0) {
    const wind = step(atk, 0, 0.6), cut = step(atk, 0.62, 0.78), rec = step(atk, 0.85, 1);
    swX = L(L(0.2, -2.7, wind), 0.95, cut) * (1 - rec) + 0.2 * rec;
    swZ = L(L(-0.25, -0.9, wind), 0.2, cut) * (1 - rec) - 0.25 * rec;
    elR = L(L(-0.5, -0.9, wind), -0.15, cut) * (1 - rec) - 0.5 * rec;
    bodyP += L(L(0, -0.25, wind), 0.45, cut) * (1 - rec);
    spineY += L(L(0, 0.45, wind), -0.5, cut) * (1 - rec);
    headP += 0.2 * cut * (1 - rec);
  }
  R(b.body, bodyP, 0, 0.03 * sway);
  R(b.spine, 0.1 + 0.05 * c.brace, spineY + look.yaw * 0.3, 0.04 * Math.sin(t * 0.7 + seed));
  R(b.chest, 0.08, look.yaw * 0.2, 0);
  R(b.head, headP - look.pitch * 0.5 - 0.6 * rise, look.yaw * 0.5, headZ);
  // ── arms: the left hangs and swings stiffly; the right carries the cutlass low, or swings it ──
  const armSw = Math.sin(ph) * 0.35 * moving;
  const riseArms = rise > 0.02 ? -2.2 * bump(1 - rise, 0, 0.9) - 0.3 * rise : 0;   // arms come up as it surfaces, then drop
  R(b.armL_sh, 0.15 - armSw + riseArms + 0.4 * c.brace + 0.6 * dead, 0, 0.25 + 0.3 * rise);
  R(b.armL_el, -0.35 - 0.2 * Math.max(0, -armSw) - 0.6 * rise, 0, 0.1);
  R(b.armR_sh, swX + armSw * 0.5 + riseArms * 0.8 + 0.8 * dead, swY, swZ - 0.2 * rise);
  R(b.armR_el, elR - 0.5 * rise, 0, -0.1);
  R(b.armR_hand, 0.35, 0, 0);
  // ── legs: a stiff-kneed shamble, knees dropping when it dies ──
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const lsw = Math.sin(ph + (sx > 0 ? 0 : Math.PI));
    const hip = b[`leg${side}_hip`], knee = b[`leg${side}_knee`], foot = b[`leg${side}_foot`];
    R(hip, -0.55 * lsw * moving - 0.1 * c.brace - 0.1 + 0.15 * kneel - 0.4 * topple, 0, sx * 0.08);
    R(knee, (0.35 + 0.4 * Math.max(0, lsw)) * moving + 0.15 * c.brace + 0.15 + 1.9 * kneel, 0, 0);
    R(foot, -0.15 * lsw * moving - 0.1, 0, 0);
  }
  squashBody(b.body, c.flinch);
}
