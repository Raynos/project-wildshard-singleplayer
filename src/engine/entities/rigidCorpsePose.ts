import type { Bone } from 'three';
import type { AnimalRigContext } from './animalRig';

type NumericPose = (context: AnimalRigContext) => void;
const numericPoses = new WeakMap<object, NumericPose>();
/** @internal The admitted numeric compiler marks its existing pure transform evaluator, never a shard hook. */
export function registerRigidCorpseAnimation(animate: NumericPose): NumericPose { numericPoses.set(animate, animate); return animate; }
/** @internal Refuse arbitrary legacy animation code in the fixed corpse phase. */
export function supportsRigidCorpseAnimation(animate: unknown): boolean { return typeof animate === 'function' && numericPoses.has(animate); }

/** Fixed-step presentation owner for an admitted numeric animation. The death snapshot never borrows mutable memory. */
export class RigidCorpsePose {
  private readonly joints;
  private readonly context: AnimalRigContext;
  private readonly animate: NumericPose;
  constructor(source: AnimalRigContext & { bones: Record<string, Bone> }, animate: unknown) {
    const evaluator = typeof animate === 'function' ? numericPoses.get(animate) : undefined;
    if (evaluator === undefined) throw new Error('Rigid corpse requires admitted numeric animation');
    this.animate = evaluator;
    const mem = Object.freeze({ ...source.mem }), position = source.position.clone();
    const variant: unknown = Reflect.get(source.animal, 'variant');
    const animal = { mem, position, yOffset: 0, variant };
    this.context = { ...source, bones: Object.freeze({ ...source.bones }), mem, position, lookTarget: source.lookTarget.clone(),
      animal, dims: structuredClone(source.dims), speed: 0, strafe: 0, alive: false, deathT: Math.max(0, source.deathT), brace: 0, attack: -1, lookWeight: 0 };
    this.joints = Object.values(source.bones).map((bone: Bone) => ({ bone,
      prevP: bone.position.clone(), curP: bone.position.clone(), prevQ: bone.quaternion.clone(), curQ: bone.quaternion.clone() }));
  }
  get complete(): boolean { return this.context.deathT >= 1; }
  get deathT(): number { return this.context.deathT; }
  get flinch(): number { return this.context.flinch; }
  /** Evaluate from the last fixed endpoint, never from an interpolated render pose. */
  step(dt: number): void {
    if (!Number.isFinite(dt) || dt < 0) throw new Error('Invalid corpse pose delta');
    this.render(1);
    const c = this.context, previous = { dt: c.dt, t: c.t, flinch: c.flinch, deathT: c.deathT }; c.dt = dt; c.t += dt;
    if (c.flinch > .001) c.flinch *= Math.exp(-dt * 5.5);
    c.deathT = Math.min(1, c.deathT + dt / .8);
    try {
      this.animate(c);
      for (const { bone } of this.joints) if ([...bone.position, ...bone.quaternion].some(n => !Number.isFinite(n))
        || Math.abs(bone.quaternion.lengthSq() - 1) > 1e-6
        || [bone.scale.x, bone.scale.y, bone.scale.z].some(n => !Number.isFinite(n) || Math.abs(n - 1) > 1e-7)) throw new Error('Unsafe corpse pose transform');
      for (const joint of this.joints) {
        joint.prevP.copy(joint.curP); joint.prevQ.copy(joint.curQ);
        joint.curP.copy(joint.bone.position); joint.curQ.copy(joint.bone.quaternion);
      }
    } catch (error) { Object.assign(c, previous); for (const { bone } of this.joints) bone.scale.setScalar(1); this.render(1); throw error; }
  }
  /** Render only interpolates published endpoints; it owns no collapse clock or callback. */
  render(alpha: number): void {
    for (const joint of this.joints) {
      joint.bone.position.lerpVectors(joint.prevP, joint.curP, alpha);
      joint.bone.quaternion.slerpQuaternions(joint.prevQ, joint.curQ, alpha);
    }
  }
}
