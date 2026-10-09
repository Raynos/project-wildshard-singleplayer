import { Euler, Matrix4, Quaternion, Vector3, type EulerOrder } from 'three';
import * as v from 'valibot';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { AnimalPoseLaw, type AnimalPoseRecipe } from '@wildshard/engine/entities/animalPose';
import { applyAnimalRoot, QuadrupedRigPose, type AnimalRigContext, type AnimalRigJoint } from '@wildshard/engine/entities/animalRig';
import { CollisionPose } from '@wildshard/game/combat/collisionPose';

/** Actual local rest chain and modifiers read from the browser's instantiated model, not invented collision bones. */
export interface DriftwoodPoseRecipe {
  readonly joints: readonly { readonly name: string; readonly parent: number; readonly position: readonly [number, number, number]; readonly order: EulerOrder; readonly scale: readonly [number, number, number] }[];
  readonly custom: boolean;
  readonly gait?: AnimalPoseRecipe['gait'];
  readonly pose?: AnimalPoseRecipe['pose'];
}
const ORIGIN = [0, 0, 0] as const;
const u32 = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffffffff));
const bits = v.pipe(v.array(u32), v.maxLength(704));
const Saved = v.strictObject({ version: v.literal(1), recipe: v.string(), scalar: v.string(), breath: v.pipe(v.number(), v.finite(), v.minValue(0)),
  local: bits, published: bits, frame: bits, leg: bits, wasAlive: v.boolean() });
const ORDERS: readonly EulerOrder[] = ['XYZ', 'YXZ', 'ZXY', 'ZYX', 'YZX', 'XZY'];
function encoded(scalars: readonly number[]): number[] {
  const out: number[] = [], data = new DataView(new ArrayBuffer(8));
  if (scalars.length > 352) throw new Error('Invalid Driftwood pose continuation');
  for (let i = 0; i < 352; i++) { const value = scalars[i]; if (value === undefined) break; if (!Number.isFinite(value)) throw new Error('Invalid Driftwood pose continuation'); data.setFloat64(0, value); out.push(data.getUint32(0), data.getUint32(4)); }
  return out;
}
function decoded(words: readonly number[], size: number): number[] {
  if (words.length !== size * 2) throw new Error('Incompatible Driftwood pose continuation');
  const out: number[] = [], data = new DataView(new ArrayBuffer(8));
  for (let i = 0; i < 352; i++) {
    if (i * 2 >= words.length) break;
    const high = words[i * 2], low = words[i * 2 + 1]; if (high === undefined || low === undefined) throw new Error('Invalid Driftwood pose continuation');
    data.setUint32(0, high); data.setUint32(4, low); const value = data.getFloat64(0); if (!Number.isFinite(value)) throw new Error('Invalid Driftwood pose continuation'); out.push(value);
  }
  return out;
}
const joint = (): AnimalRigJoint => ({ position: new Vector3(), rotation: new Euler(), scale: new Vector3(1, 1, 1) });
function values(j: AnimalRigJoint): number[] { return [j.position.x, j.position.y, j.position.z, j.rotation.x, j.rotation.y, j.rotation.z, ORDERS.indexOf(j.rotation.order), j.scale.x, j.scale.y, j.scale.z]; }
function read(j: AnimalRigJoint, data: readonly number[], start: number): void {
  const [x, y, z, rx, ry, rz, index, sx, sy, sz] = data.slice(start, start + 10), order = index === undefined ? undefined : ORDERS[index];
  if (x === undefined || y === undefined || z === undefined || rx === undefined || ry === undefined || rz === undefined || sx === undefined || sy === undefined || sz === undefined || order === undefined) throw new Error('Invalid Driftwood pose continuation');
  j.position.set(x, y, z); j.rotation.set(rx, ry, rz, order); j.scale.set(sx, sy, sz);
}

/** Renderer-free numeric pose with separate current locals and previous rendered contact publication. */
export class DriftwoodPosedVolumes {
  readonly entityId: string;
  readonly bones: Record<string, AnimalRigJoint> = {};
  readonly law: AnimalPoseLaw;
  private readonly joints: readonly AnimalRigJoint[];
  private readonly root = joint();
  private readonly published: Float64Array;
  private readonly publishedFrame = new Float64Array(16);
  private readonly frame = new Matrix4();
  private readonly quaternion = new Quaternion();
  private readonly fk: CollisionPose;
  private readonly head: number;
  private readonly body: number;
  private readonly fore: number;
  private readonly legAbd = new Float32Array(4);
  private readonly quad: QuadrupedRigPose | null;
  private readonly context: AnimalRigContext;
  private wasAlive = true;
  private readonly identity: string;
  private readonly quadClock;
  constructor(private readonly actor: AnimalSim, private readonly recipe: DriftwoodPoseRecipe, private readonly animate?: (context: AnimalRigContext) => void) {
    if (recipe.custom !== (animate !== undefined)) throw new Error('Incompatible Driftwood custom pose');
    this.identity = JSON.stringify({ id: actor.entityId, kind: actor.kind, variant: actor.variant, dims: actor.dims, recipe });
    this.entityId = actor.entityId;
    this.fk = new CollisionPose(recipe.joints);
    this.joints = recipe.joints.map(row => {
      if (row.name.length === 0 || this.bones[row.name] !== undefined) throw new Error('Invalid Driftwood pose joint');
      const j = joint(); j.position.set(...row.position); j.rotation.order = row.order; j.scale.set(...row.scale); this.bones[row.name] = j; return j;
    });
    this.head = recipe.joints.findIndex(row => row.name === 'head'); this.body = recipe.joints.findIndex(row => row.name === 'body');
    this.fore = actor.dims.fore === undefined ? -1 : recipe.joints.findIndex(row => row.name === actor.dims.fore?.bone);
    if (this.head < 0 || this.body < 0 || (actor.dims.fore !== undefined && this.fore < 0)) throw new Error('Missing Driftwood volume joint');
    this.law = new AnimalPoseLaw({ dims: actor.dims, custom: recipe.custom, ...(recipe.gait === undefined ? {} : { gait: recipe.gait }), ...(recipe.pose === undefined ? {} : { pose: recipe.pose }) });
    this.quad = recipe.custom ? null : new QuadrupedRigPose(this.bones);
    this.context = { bones: this.bones, dims: actor.dims, dt: 0, t: 0, seed: actor.seed, scale: actor.scale, speed: 0, strafe: 0, phase: 0, state: 'idle', alive: true,
      deathT: -1, flinch: 0, brace: 0, attack: -1, lookTarget: actor.lookTarget, lookWeight: 0, position: actor.position, yaw: 0, mem: actor.mem, animal: actor };
    this.quadClock = { bodyY: actor.dims.bodyY, alive: true, deathT: -1, deathSide: 1, speed: 0, legAbd: this.legAbd };
    this.published = new Float64Array(this.joints.length * 10);
    // Factory bind matrices exist before an actor's first rendered placement; no body, clocks or RNG run here.
    this.publish(); this.root.scale.setScalar(actor.scale);
  }
  /** Body animation phase only; contacts keep the previous publication until publish(). */
  advance(dt: number, t: number, near: boolean): void {
    const a = this.actor; a.advancePose(this.law, dt, t, near);
    const i = this.law.input;
    if (this.wasAlive && !a.alive) for (let l = 0; l < 4; l++) this.legAbd[l] = ((l % 2 === 0) === (i.deathSide < 0)) ? .35 : .25;
    this.wasAlive = a.alive;
    if (near) {
      if (this.animate === undefined) {
        const c = this.quadClock; c.alive = a.alive; c.deathT = i.deathT; c.deathSide = i.deathSide; c.speed = a.speed;
        this.quad?.apply(this.law.pose, dt, c);
      } else {
        const c = this.context; c.dt = dt; c.t = t; c.speed = a.speed; c.strafe = a.strafe; c.phase = this.law.phase; c.state = a.state; c.alive = a.alive;
        c.deathT = i.deathT; c.flinch = i.flinch; c.brace = i.brace * i.brace * (3 - 2 * i.brace); c.attack = a.attackPhase; c.lookWeight = this.law.lookAmt; c.yaw = a.yaw; c.mem = a.mem;
        this.animate(c);
      }
    }
    applyAnimalRoot(this.root, a.position, a.yaw, this.law.tiltPitch, this.law.tiltRoll, this.recipe.custom, a.alive, i.flinch, i.flinchPitch, i.flinchRoll);
  }
  /** The native decision owner chooses the same terrain cadence as the page; no publication. */
  sampleTerrain(): void { this.actor.samplePoseTerrain(this.law); }
  /** Explicit render-equivalent boundary after body contacts and equipment queries. Allocates nothing. */
  publish(): void {
    for (let n = 0; n < 32; n++) {
      if (n >= this.joints.length) break;
      const j = this.joints[n]; if (j === undefined) throw new Error('Missing Driftwood pose joint'); this.fk.setLocal(n, j);
      const p = n * 10; this.published[p] = j.position.x; this.published[p + 1] = j.position.y; this.published[p + 2] = j.position.z;
      this.published[p + 3] = j.rotation.x; this.published[p + 4] = j.rotation.y; this.published[p + 5] = j.rotation.z; this.published[p + 6] = ORDERS.indexOf(j.rotation.order);
      this.published[p + 7] = j.scale.x; this.published[p + 8] = j.scale.y; this.published[p + 9] = j.scale.z;
    }
    this.frame.compose(this.root.position, this.quaternion.setFromEuler(this.root.rotation), this.root.scale); this.publishedFrame.set(this.frame.elements); this.fk.solve(this.frame);
  }
  headWorld(out: Vector3): void { this.fk.point(this.head, this.actor.dims.headAt ?? ORIGIN, out); }
  bodyCapsule(rear: Vector3, front: Vector3): void {
    const d = this.actor.dims; this.fk.capsule(this.body, d.capsuleAxis === 'y' ? ORIGIN : d.bodyAt ?? ORIGIN, d.capsuleAxis ?? 'z', d.capsuleAxis === 'y' ? 0 : d.bodyPitch ?? 0, d.bodyHalfLen, rear, front);
  }
  foreCapsule(rear: Vector3, front: Vector3): boolean {
    const f = this.actor.dims.fore; if (f === undefined) return false; this.fk.capsule(this.fore, f.at, 'x', 0, f.halfLen, rear, front); return true;
  }
  /** Includes blend history, current locals and the distinct cached publication; the host snapshots the actor itself. */
  snapshot(): string {
    return JSON.stringify({ version: 1, recipe: this.identity, scalar: this.law.snapshot(), breath: this.quad?.snapshot() ?? 0,
      local: encoded([...this.joints.flatMap(values), ...values(this.root)]), published: encoded(Array.from(this.published)), frame: encoded(Array.from(this.publishedFrame)), leg: encoded(Array.from(this.legAbd)), wasAlive: this.wasAlive });
  }
  /** Strict bounded atomic restore. No posing, terrain, body, contact, RNG or publications of current locals. */
  restore(value: string): void {
    if (value.length > 65536) throw new Error('Invalid Driftwood pose continuation');
    const state = v.parse(Saved, JSON.parse(value)); if (state.recipe !== this.identity) throw new Error('Incompatible Driftwood pose continuation');
    const local = decoded(state.local, (this.joints.length + 1) * 10), published = decoded(state.published, this.published.length), frame = decoded(state.frame, 16), leg = decoded(state.leg, 4);
    const orders = [...local.filter((_n, i) => i % 10 === 6), ...published.filter((_n, i) => i % 10 === 6)];
    if (orders.some(order => !Number.isInteger(order) || ORDERS[order] === undefined) || (this.quad === null && state.breath !== 0)) throw new Error('Invalid Driftwood pose continuation');
    const validation = new AnimalPoseLaw(this.law.recipe); validation.restore(state.scalar);
    this.law.restore(state.scalar); this.quad?.restore(state.breath); this.wasAlive = state.wasAlive; this.legAbd.set(leg);
    this.published.set(published); this.publishedFrame.set(frame); this.frame.fromArray(frame);
    const probe = joint();
    for (let n = 0; n < 32; n++) { if (n >= this.joints.length) break; read(probe, published, n * 10); this.fk.setLocal(n, probe); }
    this.fk.solve(this.frame);
    this.joints.forEach((j, n) => { read(j, local, n * 10); }); read(this.root, local, this.joints.length * 10);
  }
}
