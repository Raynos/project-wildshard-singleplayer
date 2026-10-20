import type { AnimalAppliedHit, AnimalSim } from './AnimalSim';
import type { Scope } from '../app/scope';
import type { GameClock } from '../core/clock';
import { FIXED_STEP } from '../core/fixedStep';
import { CharacterMotor } from '../physics/CharacterMotor';
import { NativeRigidCorpse, type CorpseRootEndpoint } from '../physics/nativeRigidCorpse';
import type { NativeCorpseReservation } from '../physics/ragdoll';
import type { NumericCorpseJoint } from '../physics/rigidCorpse';

/** Engine-owned numeric port. Only the installed native pose owner implements these phases. */
export interface NativeCorpsePosePort {
  readonly entityId: string;
  prepareCorpseStep: (dt: number, time: number) => { readonly joints: readonly NumericCorpseJoint[]; readonly complete: boolean };
  cancelCorpseStep: () => void;
  publishCorpseRoot: (root: CorpseRootEndpoint, prepared: boolean, frozen: boolean) => void;
}
interface LethalPose extends CorpseRootEndpoint {
  readonly joints: readonly NumericCorpseJoint[];
  readonly velocity: Readonly<{ x: number; y: number; z: number }>;
}

/** Concrete transaction token, not an authored callback. Activation precedes all scalar/publication writes. */
export class NativeCorpseHandoff {
  private activated = false;
  private readonly owner: NativeCorpseOwner;
  private readonly motor: CharacterMotor;
  private readonly resource: NativeRigidCorpse;
  private readonly enabled: boolean;
  private readonly rootData: CorpseRootEndpoint;
  constructor(owner: NativeCorpseOwner, motor: CharacterMotor, resource: NativeRigidCorpse) {
    this.owner = owner; this.motor = motor; this.resource = resource; this.enabled = motor.snapshot().enabled; this.rootData = resource.endpoints().current;
    if (this.enabled !== motor.collider.isEnabled()) throw new Error('Native motor enabled state disagrees');
  }
  get root(): CorpseRootEndpoint { return this.rootData; }
  abort(): void {
    try { this.resource.abort(); } catch (error) { this.owner.fail(error); }
  }
  activate(): void {
    if (this.activated || this.owner.actor.motor !== this.motor || this.owner.scope.disposed)
      throw new Error('Invalid native corpse handoff');
    try { this.motor.setEnabled(false); this.resource.activate(); this.activated = true; }
    catch (error) {
      const failures: unknown[] = [];
      try { if (this.resource.state === 'prepared') this.resource.abort(); } catch (cleanup) { failures.push(cleanup); }
      try { this.motor.restoreEnabledState(this.enabled); } catch (rollback) { failures.push(rollback); }
      if (failures.length > 0 || this.owner.lease.state !== 'reserved') this.owner.fail(new AggregateError([error, ...failures], 'Native corpse handoff failed terminally', { cause: error }));
      throw error;
    }
  }
  /** Copy only, reached once after successful activation by AnimalSim's synchronous commit. */
  commit(): void { this.owner.adopt(this.resource, this.motor, this.rootData); }
}

/** One admitted actor's concrete physics lifetime. It never evaluates animation or advances a clock. */
export class NativeCorpseOwner {
  readonly actor: AnimalSim;
  readonly scope: Scope;
  readonly lease: NativeCorpseReservation;
  private readonly pose: NativeCorpsePosePort;
  private readonly clock: GameClock;
  private resource: NativeRigidCorpse | undefined;
  private retired: CharacterMotor | undefined;
  private birthFrame = -1;
  private preTick = -1;
  private postTick = -1;
  private prepared = false;
  private terminal = false;
  private lethalRoot: CorpseRootEndpoint | undefined;
  constructor(actor: AnimalSim, pose: NativeCorpsePosePort, lease: NativeCorpseReservation, scope: Scope, clock: GameClock) {
    if (pose.entityId !== actor.entityId || !scope.belongsTo(lease.owner) || lease.state !== 'reserved') throw new Error('Invalid native corpse owner');
    this.actor = actor; this.pose = pose; this.lease = lease; this.scope = lease.owner; this.clock = clock;
    this.scope.onDispose(() => { this.dispose(); });
  }
  get ownsRoot(): boolean { return this.resource !== undefined; }
  get deathPosition(): CorpseRootEndpoint['position'] | undefined { const p = this.lethalRoot?.position; return p === undefined ? undefined : { ...p }; }
  prepare(hit: AnimalAppliedHit, pose: LethalPose): NativeCorpseHandoff {
    const motor = this.actor.motor, physics = this.lease.physics;
    if (this.terminal || this.scope.disposed || !this.actor.alive || hit.alive || this.resource !== undefined
      || !(motor instanceof CharacterMotor) || physics.disposed || !motor.collider.isValid()
      || physics.world.getCollider(motor.collider.handle) !== motor.collider || motor.opts.owner !== this.actor)
      throw new Error('Invalid native corpse motor owner');
    try {
      const resource = NativeRigidCorpse.prepare(this.lease, { ...pose, recipe: this.actor.dims.rigidCorpse,
        dims: this.actor.dims, scale: this.actor.scale, dir: hit.direction, damage: hit.amount });
      return new NativeCorpseHandoff(this, motor, resource);
    } catch (error) { if (this.lease.state !== 'reserved') this.fail(error); throw error; }
  }
  /** @internal Copy-only owner switch; the disabled motor is retired outside logical commit. */
  adopt(resource: NativeRigidCorpse, motor: CharacterMotor, root: CorpseRootEndpoint): void {
    this.resource = resource; this.retired = motor; this.actor.motor = null;
    this.birthFrame = this.clock.frame; this.lethalRoot = root;
    this.actor.position.copy(this.lethalRoot.position);
  }
  pre(tick: number, time: number): void {
    if (this.terminal || this.scope.disposed) return;
    if (tick <= this.preTick || tick !== this.clock.frame + 1) throw new Error('Duplicate or mismatched native corpse pre');
    this.preTick = tick; this.prepared = false;
    try { this.retireMotor(); } catch (error) { this.fail(error); }
    const resource = this.resource;
    if (resource === undefined || resource.state === 'frozen') return;
    try {
      const next = this.pose.prepareCorpseStep(FIXED_STEP, time);
      resource.updateLocal(next.joints, next.complete); this.prepared = true;
    } catch (error) {
      this.pose.cancelCorpseStep();
      if (resource.state !== 'live') this.fail(error);
      throw error;
    }
  }
  post(tick: number): void {
    if (this.terminal || this.scope.disposed || this.resource === undefined) return;
    const resource = this.resource;
    if (tick <= this.postTick || tick !== this.clock.frame) throw new Error('Duplicate or mismatched native corpse post');
    this.postTick = tick;
    // A hit inside this post occurred after physics and must retain its zero-time lethal endpoint.
    if (this.birthFrame === this.clock.frame || this.resource.state === 'frozen') return;
    if (this.preTick !== tick) throw new Error('Native corpse post has no matching pre');
    try {
      resource.capture(FIXED_STEP);
      const root = resource.endpoints().current;
      this.pose.publishCorpseRoot(root, this.prepared, resource.state === 'frozen'); this.actor.position.copy(root.position); this.prepared = false;
    } catch (error) {
      // Physics/capture already happened. A failed final publication cannot be
      // treated as a recoverable pre refusal or leave a healthy frozen owner.
      this.fail(error);
    }
  }
  fail(error: unknown): never {
    this.terminal = true; this.actor.alive = false;
    try { this.scope.dispose(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'Native corpse owner failed', { cause: cleanup }); }
    throw error;
  }
  private retireMotor(): void {
    const motor = this.retired; if (motor === undefined) return;
    motor.retireForHandoff(); this.retired = undefined;
  }
  dispose(): void {
    this.terminal = true;
    const errors: unknown[] = [];
    const living = this.actor.motor;
    if (living instanceof CharacterMotor) {
      try { living.retireForHandoff(); this.actor.motor = null; } catch (error) { errors.push(error); }
    }
    try { this.retireMotor(); } catch (error) { errors.push(error); }
    try { this.lease.dispose(); } catch (error) { errors.push(error); }
    if (errors.length > 0) throw new AggregateError(errors, 'Native corpse owner cleanup failed', { cause: errors[0] });
  }
}
