import { MathUtils } from 'three';
import type { AnimalRigContext, AnimalRigJoint } from '@wildshard/engine/entities/animalRig';
import { bump, clamp, lookAngles, smooth01, step } from '@wildshard/engine/entities/species/rigs';
import type { CaptainMem } from './captainPolicy';

type Side = 'L' | 'R';
type CaptainBones = Record<'body' | 'spine' | 'chest' | 'head' | `arm${Side}_${'sh' | 'el' | 'hand'}` | `leg${Side}_${'hip' | 'knee' | 'foot'}`, AnimalRigJoint>;
const R = (b: AnimalRigJoint,x:number,y:number,z:number) => b.rotation.set(x,y,z);
const L = MathUtils.lerp;

export function animateCaptain(c: AnimalRigContext): void {
  const b = c.bones as CaptainBones, t = c.t, seed = c.seed, m = c.mem as CaptainMem;
  // the rise / sink clock and his feet under the pool run on the body step (captainPolicy.ts advanceCaptainRise); the
  // pose only reads them
  const up = m.init ? smooth01(m.rise || 0) : 0;
  const rise = 1 - up;
  const dead = c.deathT >= 0 ? smooth01(c.deathT) : 0;
  const moving = clamp(c.speed / 0.9, 0, 1);
  const ph = c.phase * Math.PI * 2;
  const atk = c.attack;
  const look = lookAngles(c, 1.6, 0.9, 0.5);
  const sway = Math.sin(t * 0.7 + seed * 4);
  const rage = (m.phase || 0) >= 3 ? 1 : 0;
  const kneel = step(dead, 0, 0.5), topple = step(dead, 0.45, 1);
  b.body.position.y = c.dims.bodyY - 0.05 - 0.05 * Math.abs(Math.sin(ph)) * moving - 0.1 * c.brace - 0.42 * kneel - 0.25 * topple + 0.02 * sway * (1 - moving);
  let bodyP = 0.16 + 0.12 * moving + 0.1 * rage + 0.15 * c.brace - 0.4 * rise + 1.35 * topple;
  let spineY = 0.06 * sway;
  let headP = -0.1 + 0.2 * c.flinch + 0.25 * kneel + 0.3 * topple;
  let swX = 0.25, swZ = -0.3, elR = -0.45;
  if (atk >= 0) {
    const wind = step(atk, 0, 0.62), cut = step(atk, 0.64, 0.8), rec = step(atk, 0.86, 1);
    swX = L(L(0.25, -2.9, wind), 1.05, cut) * (1 - rec) + 0.25 * rec;
    swZ = L(L(-0.3, -1.0, wind), 0.25, cut) * (1 - rec) - 0.3 * rec;
    elR = L(L(-0.45, -1.0, wind), -0.1, cut) * (1 - rec) - 0.45 * rec;
    bodyP += L(L(0, -0.3, wind), 0.5, cut) * (1 - rec);
    spineY += L(L(0, 0.5, wind), -0.55, cut) * (1 - rec);
    headP += 0.2 * cut * (1 - rec);
  }
  R(b.body, bodyP, 0, 0.03 * sway);
  R(b.spine, 0.08 + 0.05 * c.brace, spineY + look.yaw * 0.3, 0.04 * Math.sin(t * 0.6 + seed));
  R(b.chest, 0.06 - 0.1 * rage, look.yaw * 0.2, 0);
  R(b.head, headP - look.pitch * 0.5 - 0.7 * rise, look.yaw * 0.5, 0.1 * Math.sin(t * 0.5 + seed));
  const armSw = Math.sin(ph) * 0.3 * moving;
  const riseArms = rise > 0.02 ? -2.4 * bump(1 - rise, 0, 0.9) - 0.3 * rise : 0;
  R(b.armL_sh, 0.1 - armSw + riseArms + 0.4 * c.brace + 0.6 * dead - 0.6 * rage * (0.5 + 0.5 * Math.sin(t * 5)), 0, 0.3 + 0.3 * rise);
  R(b.armL_el, -0.4 - 0.2 * Math.max(0, -armSw) - 0.6 * rise, 0, 0.1);
  R(b.armR_sh, swX + armSw * 0.5 + riseArms * 0.8 + 0.8 * dead, 0, swZ - 0.2 * rise);
  R(b.armR_el, elR - 0.5 * rise, 0, -0.1);
  R(b.armR_hand, 0.35, 0, 0);
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const lsw = Math.sin(ph + (sx > 0 ? 0 : Math.PI));
    R(b[`leg${side}_hip`], -0.5 * lsw * moving - 0.1 * c.brace - 0.1 + 0.15 * kneel - 0.4 * topple, 0, sx * 0.07);
    R(b[`leg${side}_knee`], (0.3 + 0.4 * Math.max(0, lsw)) * moving + 0.15 * c.brace + 0.12 + 1.9 * kneel, 0, 0);
    R(b[`leg${side}_foot`], -0.15 * lsw * moving - 0.1, 0, 0);
  }
}
