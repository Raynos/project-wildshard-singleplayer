import { Quaternion, Vector3 } from 'three';
import { groups, queryGroups } from './groups';
import type { Collider, RigidBody } from '@dimforge/rapier3d-simd';
import type { Scope } from '../app/scope';
import { withOwner } from '../app/ownership';
import { FIXED_STEP } from '../core/fixedStep';
import { DamageRefusalError } from '../combat/damageRefusal';
import type { NativeCorpseReservation } from './ragdoll';
import { CORPSE_SETTLE, numericCorpseTransforms, prepareNumericRigidCorpse, rigidCorpseBodyDescriptor,
  rigidCorpseCollider, validateRigidCorpse, type NumericCorpseJoint, type NumericCorpseTransform, type RigidCorpseBodyInput } from './rigidCorpse';

export type NativeCorpseMode = 'rigid' | 'anchored-held';
export interface NativeRigidCorpseInput extends RigidCorpseBodyInput {
  /** Explicit fixed obstacle holding the lethal pose; never an animated rigid-body shortcut. */
  readonly mode?: NativeCorpseMode;
  readonly retiringCollider?: Collider;
  readonly recipe: unknown;
  readonly joints: readonly NumericCorpseJoint[];
}
export interface CorpseRootEndpoint {
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly rotation: Readonly<{ x: number; y: number; z: number; w: number }>;
}
interface PhysicalPart { readonly bone: string; readonly collider: Collider; pose: NumericCorpseTransform }
const copyRoot = (root: CorpseRootEndpoint): CorpseRootEndpoint => ({ position: { ...root.position }, rotation: { ...root.rotation } });

/** @internal One physical root, no scene graph, animation evaluator, scheduler or restore authority.
 * Admission owns the reservation. Failed preparation/activation returns it to that same actor. */
export class NativeRigidCorpse {
  private status: 'prepared' | 'live' | 'frozen' | 'failed' | 'disposed' = 'prepared';
  private previous: CorpseRootEndpoint;
  private current: CorpseRootEndpoint;
  private age = 0;
  private quiet = 0;
  private complete = false;
  private readonly anchored: boolean;
  private readonly topology;
  private readonly scale: number;
  private readonly reservation: NativeCorpseReservation;
  private readonly body: RigidBody;
  private readonly parts: readonly PhysicalPart[];
  private readonly allocation: Scope;
  private constructor(reservation: NativeCorpseReservation, body: RigidBody, parts: readonly PhysicalPart[], allocation: Scope, input: NativeRigidCorpseInput) {
    this.anchored = input.mode === 'anchored-held';
    this.reservation = reservation; this.body = body; this.parts = parts; this.allocation = allocation;
    this.current = copyRoot({ position: body.translation(), rotation: body.rotation() }); this.previous = copyRoot(this.current); this.scale = input.scale;
    this.topology = input.joints.map(joint => ({ name: joint.name, parent: joint.parent }));
  }
  get state(): 'prepared' | 'live' | 'frozen' | 'failed' | 'disposed' { return this.status; }
  get bodyHandle(): number { return this.body.handle; }
  /** Quiet detached read. Quaternion tuples are the actual physical endpoints, not Euler reconstructions. */
  endpoints(): { previous: CorpseRootEndpoint; current: CorpseRootEndpoint } {
    return { previous: copyRoot(this.previous), current: copyRoot(this.current) };
  }
  /** Prepare all numeric data before allocating a disabled body. There is no capacity check here. */
  static prepare(reservation: NativeCorpseReservation, input: NativeRigidCorpseInput): NativeRigidCorpse {
    const physics = reservation.physics, q = input.rotation;
    if (physics.disposed || reservation.state !== 'reserved') throw new Error('Native corpse requires a live admission reservation');
    validateRigidCorpse(input.recipe);
    if (input.recipe.posePolicy !== undefined) throw new Error('Native corpse requires animated pose ownership');
    const vectors = [input.position, input.velocity, input.dir];
    if (vectors.some(v => ![v.x, v.y, v.z].every(Number.isFinite))
      || ![q.x, q.y, q.z, q.w, input.damage, input.scale].every(Number.isFinite)
      || input.damage < 0 || input.scale <= 0 || Math.abs(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w - 1) > 1e-6
      || !Number.isFinite(input.dims.bodyY)
      || [input.dims.halfWidth, input.dims.bodyHalfLen, input.dims.bodyRadius].some(n => !Number.isFinite(n) || n <= 0)) throw new Error('Unsafe native corpse body');
    if (input.mode !== undefined && !['rigid', 'anchored-held'].includes(input.mode)) throw new Error('Invalid native corpse mode');
    const prepared = prepareNumericRigidCorpse(physics.R, input.recipe, input.joints, input.scale);
    const anchored = input.mode === 'anchored-held';
    if (anchored) {
      if (input.retiringCollider === undefined || !input.retiringCollider.isValid() || physics.world.getCollider(input.retiringCollider.handle) !== input.retiringCollider) throw new Error('Anchored corpse requires its retiring live collider');
      const rootRotation = new Quaternion(input.rotation.x,input.rotation.y,input.rotation.z,input.rotation.w);
      const query = queryGroups(['WORLD','PLAYER','CREATURE','ITEM'],'WORLD');
      const candidates: Collider[] = [];
      // Like canStandAt, inspect current collider transforms, not the broadphase from
      // the previous step. A lethal hit can follow player/creature movement in fixed.post.
      // The recipe already bounds hull count; inspect every relevant world collider,
      // with no arbitrary candidate cap that could admit an overlapping obstacle.
      physics.world.forEachCollider(collider => {
        const collision = collider.collisionGroups();
        if (!collider.isEnabled() || collider.isSensor() || collider === input.retiringCollider
          || ((collision >>> 16) & query & 0xffff) === 0
          || ((query >>> 16) & collision & 0xffff) === 0) return;
        candidates.push(collider);
      });
      for (const part of prepared) {
        const at = new Vector3().copy(part.pose.position).applyQuaternion(rootRotation).add(input.position);
        const rotation = rootRotation.clone().multiply(new Quaternion().copy(part.pose.rotation));
        for (const collider of candidates) {
          const contact = collider.contactShape(part.desc.shape,at,rotation,0);
          // Match existing numeric-rig transform precision; zero-distance touching is allowed.
          if (contact !== null && !Number.isFinite(contact.distance)) throw new Error(`Unsafe anchored corpse contact: ${part.bone}`);
          if (contact !== null && contact.distance < -1e-6)
            throw new DamageRefusalError(`Anchored corpse has obstructed lethal hull: ${part.bone}`);
        }
      }
    }
    const desc = (anchored ? physics.R.RigidBodyDesc.fixed().setTranslation(input.position.x,input.position.y,input.position.z).setRotation(input.rotation)
      : rigidCorpseBodyDescriptor(physics.R, input)).setEnabled(false);
    const bodyVectors = [desc.translation, desc.linvel, desc.angvel, desc.centerOfMass, desc.principalAngularInertia];
    // bodyY is a pivot coordinate, not an extent; zero/negative pivots do not license zero inertia.
    const inertia = desc.principalAngularInertia;
    if (bodyVectors.some(v => ![v.x, v.y, v.z].every(n => Number.isFinite(Math.fround(n))))
      || !anchored && ![inertia.x, inertia.y, inertia.z].every(n => Math.fround(n) > 0)) throw new Error('Unsafe native corpse body descriptor');
    const retained = new Set<RigidBody>(); physics.world.forEachRigidBody(body => { retained.add(body); });
    reservation.begin(); const allocation = reservation.owner.child('native-rigid-corpse');
    let body: RigidBody | undefined; const parts: PhysicalPart[] = [];
    try {
      body = withOwner(allocation, () => physics.world.createRigidBody(desc));
      const parent = body;
      for (const part of prepared) {
        const pose = part.pose;
        const shape = rigidCorpseCollider(part.desc, 0);
        if (anchored) shape.setCollisionGroups(groups('WORLD')).setSolverGroups(groups('WORLD'));
        const collider = withOwner(allocation, () => physics.world.createCollider(shape, parent));
        // Use the same native setter normalization at creation, updates and rollback.
        collider.setTranslationWrtParent(pose.position); collider.setRotationWrtParent(pose.rotation);
        parts.push({ bone: part.bone, pose, collider });
      }
      const resource = new NativeRigidCorpse(reservation, body, parts, allocation, input);
      reservation.attach(resource); return resource;
    } catch (error) {
      // A native wrapper may throw after allocating but before returning its handle.
      // This synchronous transaction creates exactly one body and no other owners run.
      if (body === undefined && !reservation.physics.disposed) physics.world.forEachRigidBody(candidate => {
        if (!retained.has(candidate)) {
          if (body !== undefined) throw new AggregateError([error], 'Unexpected multiple native corpse allocations', { cause: error });
          body = candidate;
        }
      });
      if (body !== undefined && !reservation.physics.disposed && body.isValid()) {
        const resource = new NativeRigidCorpse(reservation, body, parts, allocation, input);
        reservation.attach(resource);
        try { resource.abort(); } catch (cleanup) {
          throw new AggregateError([error, cleanup], 'Native corpse allocation cleanup failed', { cause: cleanup });
        }
      } else {
        try { allocation.dispose(); } catch (cleanup) {
          reservation.dispose(); throw new AggregateError([error, cleanup], 'Native corpse allocation cleanup failed', { cause: cleanup });
        }
        if (reservation.physics.disposed) reservation.dispose(); else reservation.cancel();
      }
      throw error;
    }
  }

  /** Resource activation only. The actor/motor handoff must run before logical damage commits. */
  activate(): void {
    if (this.status !== 'prepared' || this.reservation.state !== 'prepared' || this.reservation.physics.disposed)
      throw new Error('Invalid native corpse activation');
    try { this.body.setEnabled(true); this.reservation.activate(this); this.status = 'live'; }
    catch (error) {
      try { this.abort(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'Native corpse activation cleanup failed', { cause: cleanup }); }
      throw error;
    }
  }
  /** Abort only a prospective body; keep the admitted opponent's slot for a subsequent valid hit. */
  abort(): void {
    if (this.status !== 'prepared') throw new Error('Only a prepared native corpse can abort');
    this.retire(true, 'disposed');
  }
  /** Existing pre-physics boundary supplies the one numeric owner's locals. Validate the whole set first. */
  updateLocal(joints: readonly NumericCorpseJoint[], complete: boolean): void {
    if (this.anchored) throw new Error('Anchored corpse holds its lethal pose');
    if (this.status !== 'live' || this.reservation.physics.disposed) throw new Error('Native corpse is not live');
    if (joints.length !== this.topology.length || joints.some((joint, i) => { const expected = this.topology[i]; return expected === undefined || joint.name !== expected.name || joint.parent !== expected.parent; }))
      throw new Error('Native corpse hierarchy changed');
    const poses = new Map(numericCorpseTransforms(joints, this.scale).map(row => [row.bone, row]));
    const prepared = this.parts.map(part => {
      const next = poses.get(part.bone), previous = part.pose;
      if (next === undefined) throw new Error('Missing native corpse transform');
      return { part, next, previous };
    });
    try {
      for (const { part, next } of prepared) { part.collider.setTranslationWrtParent(next.position); part.collider.setRotationWrtParent(next.rotation); }
      if (!complete) this.body.wakeUp();
      for (const { part, next } of prepared) part.pose = next;
      this.complete = complete;
    } catch (error) {
      try {
        for (const { part, previous } of prepared) {
          // Replay the last accepted numeric input, not a quantized quaternion read back from Rapier.
          part.collider.setTranslationWrtParent(previous.position); part.collider.setRotationWrtParent(previous.rotation);
        }
      } catch (rollback) {
        try { this.dispose(); } catch (cleanup) { throw new AggregateError([error, rollback, cleanup], 'Native corpse collider cleanup failed', { cause: cleanup }); }
        throw new AggregateError([error, rollback], 'Native corpse collider rollback failed', { cause: rollback });
      }
      throw error;
    }
  }
  /** Existing post-physics boundary only. This reads physics; it never steps it or evaluates a local pose. */
  capture(dt: number): void {
    if (!Number.isFinite(dt) || dt !== FIXED_STEP) throw new Error('Native corpse requires the existing fixed step');
    if (this.status !== 'live') return;
    if (this.reservation.physics.disposed || !this.body.isValid()) { this.dispose(); return; }
    const p = this.body.translation(), q = this.body.rotation(), v = this.body.linvel(), w = this.body.angvel();
    if (![p.x, p.y, p.z, q.x, q.y, q.z, q.w, v.x, v.y, v.z, w.x, w.y, w.z].every(Number.isFinite)
      || Math.abs(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w - 1) > 1e-6) throw new Error('Unsafe physical corpse endpoint');
    this.previous = this.current; this.current = copyRoot({ position: p, rotation: q });
    // Fixed obstacles remain real and keep their existing slot until bout disposal.
    if (this.anchored) { this.status = 'frozen'; return; }
    this.age += dt;
    const fastest = Math.max(Math.hypot(v.x, v.y, v.z), Math.hypot(w.x, w.y, w.z) * CORPSE_SETTLE.spinLever);
    this.quiet = this.complete && fastest < CORPSE_SETTLE.speed ? this.quiet + dt : 0;
    if (this.age >= CORPSE_SETTLE.age || this.complete && (this.body.isSleeping() || this.quiet >= CORPSE_SETTLE.quiet)) {
      this.retire(false, 'frozen');
    }
  }
  dispose(): void {
    if (this.status === 'disposed') return;
    if (this.status === 'frozen' && !this.anchored) { this.status = 'disposed'; return; }
    this.retire(false, 'disposed');
  }
  private retire(retain: boolean, next: 'frozen' | 'disposed'): void {
    const physics = this.reservation.physics, errors: unknown[] = [];
    try { if (!physics.disposed && this.body.isValid()) physics.world.removeRigidBody(this.body); } catch (error) { errors.push(error); }
    // Even a failing native removal must drain the concrete allocation owner.
    try { this.allocation.dispose(); } catch (error) { errors.push(error); }
    if (physics.disposed || !this.body.isValid()) {
      this.reservation.finish(this, retain && errors.length === 0 && !physics.disposed);
      this.status = errors.length === 0 ? next : 'disposed';
    } else {
      // Keep the exact slot while a physical body remains. The concrete resource
      // stays attached to the lease, so explicit disposal can retry after Scope closed.
      this.status = 'failed';
      if (errors.length === 0) errors.push(new Error('Native corpse body survived removal'));
    }
    if (errors.length > 0) throw new AggregateError(errors, 'Native corpse cleanup failed', { cause: errors[0] });
  }
}
