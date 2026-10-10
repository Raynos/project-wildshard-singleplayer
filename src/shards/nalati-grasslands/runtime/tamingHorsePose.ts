import { Bone, Group, type Vector3 } from 'three';
import * as v from 'valibot';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { AnimalPoseLaw } from '@wildshard/engine/entities/animalPose';
import { QuadrupedRigPose, applyAnimalRoot, type AnimalRigContext } from '@wildshard/engine/entities/animalRig';
import { HORSE_SPECIES, poseNalatiHorse } from '../species/horse';
import { bodyKey } from '../species/bodyKey';
import rows from '../data/bodies.json' with { type: 'json' };

const finite = v.pipe(v.number(), v.finite());
const triple = v.tuple([finite, finite, finite]);
const transform = v.strictObject({ p: triple, r: triple, order: v.picklist(['XYZ', 'YXZ', 'ZXY', 'ZYX', 'YZX', 'XZY']), s: triple });
const Saved = v.strictObject({ pose: v.string(), breath: finite, root: transform,
  bones: v.pipe(v.array(v.tuple([v.string(), transform])), v.maxLength(32)) });
const local = (b: Bone | Group) => ({ p: b.position.toArray(), r: [b.rotation.x, b.rotation.y, b.rotation.z], order: b.rotation.order, s: b.scale.toArray() });
const restoreLocal = (b: Bone | Group, row: v.InferOutput<typeof transform>): void => {
  b.position.fromArray(row.p); b.rotation.set(row.r[0], row.r[1], row.r[2], row.order); b.scale.fromArray(row.s);
};
/** Actual horse bind joints and the page's same scalar/joint/overlay laws, without geometry or a renderer. */
export class NalatiTamingHorsePose {
  private readonly root = new Group();
  private readonly bones: Record<string, Bone> = {};
  private readonly joints: readonly Bone[];
  private readonly pose: AnimalPoseLaw;
  private readonly jointPose: QuadrupedRigPose;
  private readonly context: AnimalRigContext;
  private readonly clock = { bodyY: 0, alive: true, deathT: -1, deathSide: 1, speed: 0, legAbd: new Float32Array(4) };
  constructor(private readonly actor: AnimalSim, private readonly wind: () => { readonly x: number; readonly z: number; readonly strength: number }) {
    const variant = HORSE_SPECIES.variants.find(a => a.id === actor.variant);
    if (variant === undefined) throw new Error('Missing actual taming horse variant');
    const row = rows.bodies.find(b => b.key === bodyKey('horse', variant));
    if (row === undefined || row.bones.length > 32) throw new Error('Missing actual taming horse joints');
    const joints: Bone[] = [];
    for (let i = 0; i < 32; i++) {
      const def = row.bones[i]; if (def === undefined) break;
      const b = new Bone(), parent = def.parent === null ? undefined : row.bones.find(p => p.name === def.parent);
      if (def.parent !== null && parent === undefined) throw new Error('Missing horse joint parent');
      b.name = def.name; b.position.set((def.pos[0] ?? 0) - (parent?.pos[0] ?? 0),
        (def.pos[1] ?? 0) - (parent?.pos[1] ?? 0), (def.pos[2] ?? 0) - (parent?.pos[2] ?? 0));
      if (this.bones[b.name] !== undefined) throw new Error('Duplicate horse joint');
      this.bones[b.name] = b; joints.push(b);
      const owner = parent === undefined ? this.root : this.bones[parent.name];
      if (owner === undefined) throw new Error('Horse joints must follow parent order'); owner.add(b);
    }
    this.joints = joints;
    this.pose = new AnimalPoseLaw({ dims: actor.dims, custom: false,
      ...(HORSE_SPECIES.gait === undefined ? {} : { gait: HORSE_SPECIES.gait }),
      ...(HORSE_SPECIES.pose === undefined ? {} : { pose: HORSE_SPECIES.pose }) });
    this.jointPose = new QuadrupedRigPose(this.bones);
    this.context = { bones: this.bones, dims: actor.dims, dt: 0, t: 0, seed: actor.seed, scale: actor.scale,
      speed: 0, strafe: 0, phase: 0, state: 'idle', alive: true, deathT: -1, flinch: 0, brace: 0, attack: -1,
      lookTarget: actor.lookTarget, lookWeight: 0, position: actor.position, yaw: actor.yaw, mem: actor.mem, animal: actor };
    this.root.scale.setScalar(actor.scale); this.root.position.copy(actor.position); this.root.rotation.y = actor.yaw;
    this.root.updateMatrixWorld(true);
  }
  /** Same sampled terrain targets as the page manager's decision cadence. */
  sampleTerrain(): void { this.actor.samplePoseTerrain(this.pose); }
  /** Advance only at the actual owned body cadence, with the page's 140 m animation LOD. */
  advance(dt: number, time: number, near: boolean): void {
    const a = this.actor, c = this.context;
    a.advancePose(this.pose, dt, time, near, false);
    const input = this.pose.input;
    if (near) {
      this.clock.bodyY = a.dims.bodyY; this.clock.alive = a.alive; this.clock.deathT = input.deathT;
      this.clock.deathSide = input.deathSide; this.clock.speed = a.speed;
      this.jointPose.apply(this.pose.pose, dt, this.clock);
      c.dt = dt; c.t = time; c.speed = a.speed; c.strafe = a.strafe; c.phase = this.pose.phase; c.state = a.state; c.alive = a.alive;
      c.deathT = input.deathT; c.flinch = input.flinch; c.brace = input.brace * input.brace * (3 - 2 * input.brace);
      c.attack = a.attackPhase; c.lookWeight = this.pose.lookAmt; c.yaw = a.yaw; c.mem = a.mem;
      poseNalatiHorse(c, this.wind());
    }
    applyAnimalRoot(this.root, a.position, a.yaw, this.pose.tiltPitch, this.pose.tiltRoll, false, a.alive, input.flinch, 0, 0);
    this.root.scale.setScalar(a.scale); this.root.updateMatrixWorld(true);
  }
  /** The page reads the actual posed head matrix, including headAt, for the stare challenge. */
  headWorld(out: Vector3): Vector3 {
    const head = this.bones['head']; if (head === undefined) throw new Error('Missing actual horse head');
    const at = this.actor.dims.headAt;
    return at === undefined ? out.setFromMatrixPosition(head.matrixWorld) : out.set(at[0], at[1], at[2]).applyMatrix4(head.matrixWorld);
  }
  /** All local joints are kept when far LOD freezes them; restore must retain those exact observations. */
  snapshot(): string { return JSON.stringify({ pose: this.pose.snapshot(), breath: this.jointPose.snapshot(),
    root: local(this.root), bones: this.joints.map(b => [b.name, local(b)]) }); }
  /** Validate the complete fixed hierarchy before quiet restoration; no posing or random draws. */
  restore(wire: string): void {
    if (wire.length > 32768) throw new Error('Nalati horse pose wire exceeds its bound');
    const state = v.parse(Saved, JSON.parse(wire));
    if (state.bones.length !== this.joints.length || new Set(state.bones.map(([name]) => name)).size !== this.joints.length
      || state.bones.some(([name], i) => this.joints[i]?.name !== name)) throw new Error('Foreign horse pose joints');
    const checked = new AnimalPoseLaw(this.pose.recipe); checked.restore(state.pose);
    if (state.breath < 0) throw new Error('Invalid horse breathing clock');
    this.pose.restore(state.pose); this.jointPose.restore(state.breath); restoreLocal(this.root, state.root);
    state.bones.forEach(([name, row]) => { const b = this.bones[name]; if (b !== undefined) restoreLocal(b, row); });
    this.context.mem = this.actor.mem; this.root.updateMatrixWorld(true);
  }
}
