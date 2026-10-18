import type { Euler, Vector3 } from 'three';
import type { AnimalRigContext } from './engine/entities/animalRig';
import { numericCreaturePose as admittedNumericPose } from './game/plugin/channelPrograms';

const FEET = ['finL', 'finR', 'rearL', 'rearR'] as const;
interface Foot { position: Vector3; rotation: Euler }
interface Displayed { feet: Foot[]; bodyY: number; bodyRotation: Euler }
interface Blend { from: Displayed; elapsed: number; duration: number }
interface History { shown: Displayed; moving: boolean; stage: number; time: number; blend: Blend | null }
const copy = (c: AnimalRigContext): Displayed | null => {
  const body = c.bones['body']; if (body === undefined) return null;
  const feet: Foot[] = [];
  for (const name of FEET) { const bone = c.bones[name]; if (bone === undefined) return null; feet.push({ position: bone.position.clone(), rotation: bone.rotation.clone() }); }
  return { feet, bodyY: body.position.y, bodyRotation: body.rotation.clone() };
};
const angularDistance = (a: Euler, b: Euler): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);

/** Preview-only visual continuation. The exact gait5 importer route selects this implementation;
 * original admission runs unchanged. No actor memory, clock, phase, collider or persistent state is written. */
export function numericCreaturePose(input: unknown): (context: AnimalRigContext) => void {
  const admitted = admittedNumericPose(input);
  const histories = new WeakMap<AnimalRigContext['bones'], History>();
  return c => {
    const prior = histories.get(c.bones);
    admitted(c);
    const target = copy(c); if (target === null) return;
    const stageValue: unknown = c.mem['puffer-st'];
    const stage = typeof stageValue === 'number' ? stageValue : 0;
    const moving = Math.abs(c.speed) > .001;
    if (prior === undefined || !c.alive || c.deathT > 0 || !Number.isFinite(c.dt) || c.dt < 0 || c.dt > .25 || c.t < prior.time) {
      histories.set(c.bones, { shown: target, moving, stage, time: c.t, blend: null }); return;
    }
    const stopped = prior.moving && !moving;
    const enteredAttack = prior.stage !== 1 && stage === 1;
    const resumed = !prior.moving && moving && stage === 0;
    let blend = prior.blend;
    if (stopped || enteredAttack || resumed) blend = { from: prior.shown, elapsed: 0, duration: resumed ? .12 : .22 };
    else if (blend !== null && c.t > prior.time) blend.elapsed += c.dt;
    if (blend !== null) {
      const u = Math.min(1, blend.elapsed / blend.duration), alpha = u * u * (3 - 2 * u);
      // Body translation rebasing avoids carrying old negative bob compensation under a lower body.
      // A conservative 2m rotation radius bounds local living toe excursions; weighted cross-frame audit is required.
      const bodyAngle = angularDistance(blend.from.bodyRotation, target.bodyRotation);
      const bodyUp = Math.max(.8, Math.abs(Math.cos(target.bodyRotation.x) * Math.cos(target.bodyRotation.z)));
      for (const [i, name] of FEET.entries()) {
        const bone = c.bones[name], from = blend.from.feet[i], to = target.feet[i];
        if (bone === undefined || from === undefined || to === undefined) continue;
        bone.position.copy(from.position).lerp(to.position, alpha);
        bone.rotation.set(from.rotation.x + (to.rotation.x - from.rotation.x) * alpha,
          from.rotation.y + (to.rotation.y - from.rotation.y) * alpha,
          from.rotation.z + (to.rotation.z - from.rotation.z) * alpha, to.rotation.order);
        const footAngle = angularDistance(from.rotation, to.rotation) * alpha;
        bone.position.y += (1 - alpha) * (blend.from.bodyY - target.bodyY + 2 * (bodyAngle + footAngle)) / bodyUp;
      }
      if (u >= 1) blend = null;
    }
    histories.set(c.bones, { shown: copy(c) ?? target, moving, stage, time: c.t, blend });
  };
}
