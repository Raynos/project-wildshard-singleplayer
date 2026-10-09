import * as THREE from 'three';
import type { AnimalRigContext, AnimalRigJoint } from '@wildshard/engine/entities/animalRig';
import { bump, clamp, lookAngles, smooth01, squashBody, step } from '@wildshard/engine/entities/species/rigs';

type Side = 'L' | 'R';
type CrabBones = Record<'body' | 'head' | `claw${Side}_${'arm' | 'hand' | 'tip'}` | `leg${Side}${LegIdx}_${'hip' | 'knee'}`, AnimalRigJoint>;
type LegIdx = 0 | 1 | 2;
const LEG_IDX: readonly LegIdx[] = [0,1,2];
const TRIPOD_A = new Set(['L0','R1','L2']);

export function animateCrab(c: AnimalRigContext): void {
  const b = c.bones as CrabBones, t = c.t, seed = c.seed;
  const moving = clamp(Math.hypot(c.speed, c.strafe) / 0.5, 0, 1);
  const strafeK = clamp(c.strafe / 1.3, -1, 1);
  const fwdK = clamp(c.speed / 1.5, -1, 1);
  const dead = c.deathT >= 0 ? smooth01(c.deathT) : 0;
  const engaged = c.state === 'sidestep' || c.state === 'attack' || c.state === 'alert';
  const atk = c.attack;
  // ── claws: raised while engaged, the snap = raise both over 2/3 of the attack then slam down and shut ──
  let raise = engaged ? 0.55 : 0.15, spread = engaged ? 0.25 : 0.0, open = engaged ? 0.35 : 0.1;
  if (atk >= 0) {
    const wind = step(atk, 0, 0.62), slam = step(atk, 0.64, 0.78), rec = step(atk, 0.86, 1);
    raise = THREE.MathUtils.lerp(raise, 1.35, wind) * (1 - slam) + 0.05 * slam * (1 - rec) + raise * rec;
    open = THREE.MathUtils.lerp(open, 0.85, wind) * (1 - slam) + 0.0 * slam;
    spread = THREE.MathUtils.lerp(spread, 0.55, wind) * (1 - slam) - 0.25 * slam;
  }
  raise += 0.5 * c.brace - 0.9 * dead;                          // braced: claws up; dead: claws drop
  const twitch = 0.05 * Math.sin(t * 2.7 + seed * 5);
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const arm = b[`claw${side}_arm`], hand = b[`claw${side}_hand`], tip = b[`claw${side}_tip`];
    arm.rotation.set(-raise * 0.7, sx * (spread * 0.6 + twitch), sx * raise * 0.35);
    hand.rotation.set(-raise * 0.5, sx * spread * 0.5, 0);
    tip.rotation.set(0, sx * -(open * 0.6), -sx * open * 0.15);
  }
  // ── legs: two tripods, lift + swing; the sidestep reaches the leading legs out and folds the trailing ones ──
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    for (const i of LEG_IDX) {
      const hip = b[`leg${side}${i}_hip`], knee = b[`leg${side}${i}_knee`];
      const lp = (c.phase + (TRIPOD_A.has(side + i) ? 0 : 0.5)) % 1;
      const swing = lp < 0.42 ? Math.sin((lp / 0.42) * Math.PI) : 0;           // in the air
      const along = lp < 0.42 ? -Math.cos((lp / 0.42) * Math.PI) : 1 - 2 * ((lp - 0.42) / 0.58);   // -1 → 1 forward in the air, back on the ground
      const lift = swing * 0.42 * moving;
      // + rotation.z on a left leg raises it; rotation.y swings it along the body (sign by side)
      const reach = strafeK * sx;                                             // this side leads the sidestep
      const idle = (1 - moving) * 0.03 * Math.sin(t * 1.3 + i * 1.9 + seed * 3);
      hip.rotation.set(0, -sx * along * 0.30 * fwdK * moving, sx * (lift + idle + 0.22 * reach * swing));
      knee.rotation.set(0, 0, sx * (0.25 * swing * moving - 0.30 * reach * (1 - swing) * moving + 0.55 * c.flinch));
      if (dead > 0) { hip.rotation.z = sx * (0.15 + 0.5 * dead); knee.rotation.z = sx * 1.25 * dead; }
    }
  }
  // ── body: bob with the skitter, a low crouch when braced / flinching, drops to the sand when dead ──
  const bob = 0.012 * Math.sin(c.phase * Math.PI * 4) * moving;
  b.body.position.y = c.dims.bodyY + bob + 0.006 * Math.sin(t * 1.5 + seed) - 0.05 * c.brace - 0.03 * c.flinch - 0.11 * dead + 0.03 * (atk >= 0 ? bump(atk, 0.6, 0.85) : 0);
  b.body.rotation.set(0.05 * c.flinch + 0.08 * (atk >= 0 ? step(atk, 0, 0.62) : 0) - 0.06 * dead, 0, strafeK * 0.06 * moving);
  // ── eyestalks follow the target ──
  const look = lookAngles(c, 0.36, 1.0, 0.5);
  b.head.rotation.set(-look.pitch * 0.4 + 0.15 * dead, look.yaw * 0.6, 0.06 * Math.sin(t * 3.1 + seed * 7));
  squashBody(b.body, c.flinch);
}
