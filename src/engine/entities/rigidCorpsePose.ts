import type { Bone } from 'three';
import type { AnimalRigContext } from './animalRig';

type PoseInputs = Pick<AnimalRigContext, 'mem' | 'phase' | 'state' | 'yaw'>;

type NumericPose = (context: AnimalRigContext) => void;
const numericPoses = new WeakMap<object, NumericPose>();
/** @internal The admitted numeric compiler marks its existing pure transform evaluator, never a shard hook. */
export function registerRigidCorpseAnimation(animate: NumericPose): NumericPose { numericPoses.set(animate, animate); return animate; }
/** @internal Refuse arbitrary legacy animation code in the fixed corpse phase. */
export function supportsRigidCorpseAnimation(animate: unknown): boolean { return typeof animate === 'function' && numericPoses.has(animate); }

/** Fixed-step owner for admitted numeric animation. Captured policy holds every lethal local transform,
 * with no later evaluator/input reads or animation-clock advance. The root still responds immediately to physics. */
export class RigidCorpsePose {
  private readonly joints;
  private readonly captured: boolean;
  private context: AnimalRigContext;
  private readonly animate: NumericPose;
  private readonly inputs: PoseInputs;
  constructor(source: AnimalRigContext & { bones: Record<string, Bone> }, animate: unknown, inputs: PoseInputs = source, posePolicy?: 'captured') {
    this.captured = posePolicy === 'captured';
    const evaluator = typeof animate === 'function' ? numericPoses.get(animate) : undefined;
    if (evaluator === undefined) throw new Error('Rigid corpse requires admitted numeric animation');
    this.animate = evaluator; this.inputs = inputs;
    const mem = Object.freeze({ ...source.mem }), position = Object.freeze(source.position.clone());
    const variant: unknown = Reflect.get(source.animal, 'variant');
    const animal = { mem, position, yOffset: 0, variant };
    this.context = { ...source, bones: Object.freeze({ ...source.bones }), mem, position, lookTarget: Object.freeze(source.lookTarget.clone()),
      animal: Object.freeze(animal), dims: Object.freeze(structuredClone(source.dims)), speed: 0, strafe: 0, alive: false, deathT: Math.max(0, source.deathT), brace: 0, attack: -1, lookWeight: 0 };
    this.joints = Object.values(source.bones).map((bone: Bone) => ({ bone,
      prevP: bone.position.clone(), curP: bone.position.clone(), prevQ: bone.quaternion.clone(), curQ: bone.quaternion.clone() }));
    if (this.captured) {
      for (const joint of this.joints) {
        const { bone } = joint;
        if ([...bone.position, ...bone.quaternion].some(n => !Number.isFinite(n))
          || Math.abs(bone.quaternion.lengthSq() - 1) > 1e-6
          || [bone.scale.x, bone.scale.y, bone.scale.z].some(n => !Number.isFinite(n) || Math.abs(n - 1) > 1e-7)) throw new Error('Unsafe captured corpse pose');
        Object.freeze(joint.prevP); Object.freeze(joint.curP); Object.freeze(joint.prevQ); Object.freeze(joint.curQ); Object.freeze(joint);
      }
      Object.freeze(this.joints);
    }
  }
  get posePolicy(): 'captured' | undefined { return this.captured ? 'captured' : undefined; }
  get complete(): boolean { return this.captured || this.context.deathT >= 1; }
  get deathT(): number { return this.context.deathT; }
  get flinch(): number { return this.context.flinch; }
  /** Evaluate from the last fixed endpoint, never from an interpolated render pose. */
  step(dt: number): void {
    if (!Number.isFinite(dt) || dt < 0) throw new Error('Invalid corpse pose delta');
    this.render(1);
    if (this.captured) return;
    try {
      // Death handlers may run after construction, or in fixed.post after our first pre step.
      // Read again at every owning boundary, but never lend live actor memory to the evaluator.
      const input = this.inputs, previous = this.context;
      const mem = Object.freeze({ ...input.mem });
      const c: AnimalRigContext = Object.freeze({ ...previous, mem,
        phase: input.phase, state: input.state, yaw: input.yaw,
        animal: Object.freeze({ ...previous.animal, mem }),
        dt, t: previous.t + dt, deathT: Math.min(1, previous.deathT + dt / .8),
        flinch: previous.flinch > .001 ? previous.flinch * Math.exp(-dt * 5.5) : previous.flinch });
      this.animate(c);
      for (const { bone } of this.joints) if ([...bone.position, ...bone.quaternion].some(n => !Number.isFinite(n))
        || Math.abs(bone.quaternion.lengthSq() - 1) > 1e-6
        || [bone.scale.x, bone.scale.y, bone.scale.z].some(n => !Number.isFinite(n) || Math.abs(n - 1) > 1e-7)) throw new Error('Unsafe corpse pose transform');
      for (const joint of this.joints) {
        joint.prevP.copy(joint.curP); joint.prevQ.copy(joint.curQ);
        joint.curP.copy(joint.bone.position); joint.curQ.copy(joint.bone.quaternion);
      }
      this.context = c;
    } catch (error) { for (const { bone } of this.joints) bone.scale.setScalar(1); this.render(1); throw error; }
  }
  /** Render only interpolates published endpoints; it owns no collapse clock or callback. */
  render(alpha: number): void {
    for (const joint of this.joints) {
      if (this.captured) { joint.bone.position.copy(joint.curP); joint.bone.quaternion.copy(joint.curQ); continue; }
      joint.bone.position.lerpVectors(joint.prevP, joint.curP, alpha);
      joint.bone.quaternion.slerpQuaternions(joint.prevQ, joint.curQ, alpha);
    }
  }
}
