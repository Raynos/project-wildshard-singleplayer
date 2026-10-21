import * as v from 'valibot';
import { DeclaredBodyOpsSchema, declaredBodyRegistries, type DeclaredBodyOpsRows } from '@wildshard/format/bodySlots';
import { SCRIPT_V1_COMMANDS as Commands, SCRIPT_V1_READS as Reads, type ScriptV1Command } from '@wildshard/format/scriptAbiV1';
import { Bodies, Body, type BodySpec } from '@wildshard/engine/physics/bodies';
import { staticBoxCollider } from '@wildshard/engine/physics/query';
import type { SimHost } from '@wildshard/engine/sim';
import type { DecisionCommit } from '@wildshard/engine/script/decision';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { ShardContext } from '../plugin/context';

type Owner = SimHost | ShardContext;
type Row = DeclaredBodyOpsRows['bodies'][number];
interface Slot { row: Row; body: Body | null; actor: Animal | null; visible: boolean; yaw: number }
function spec(row: Row): BodySpec {
  if (row.kind !== 'prop') throw new Error('Declared actor is not a prop');
  const { id: _id, at: _at, yaw: _yaw, kind: _kind, ...profile } = row;
  return profile;
}
function requireLive(owner: Owner): void { if (owner.scope.disposed) throw new Error('Declared body owner disposed'); }
function upright(yaw: number) { return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }; }

/** Data-only declared body mechanics. The existing decision owner lends these
 * reads/commands internally, keeping its clock, queued commits and save envelope.
 * Props retain the existing Bodies service/caps; page actors are real native
 * species bodies removed immediately from combat/aim/minimap target lists. */
export class DeclaredBodyOps {
  readonly registries;
  private readonly slots = new Map<number, Slot>();
  private readonly rows: DeclaredBodyOpsRows;
  private readonly native: SimHost | null;
  private readonly page: ShardContext | null;
  private service: Bodies | null;
  private disposed = false;
  private forgetCleanup: (() => void) | undefined;
  private constructor(private readonly owner: Owner, rows: DeclaredBodyOpsRows) {
    this.rows = rows; this.native = 'physics' in owner ? owner : null; this.page = 'physics' in owner ? null : owner;
    this.registries = declaredBodyRegistries(rows);
    this.service = this.native === null ? this.page?.app.bodies ?? null : new Bodies(this.native.physics, this.native.player.position);
    if (rows.bodies.some(row => row.kind === 'prop') && this.service === null) throw new Error('Declared props require the installed body service');
    for (const row of rows.bodies) {
      const id = this.registries.bodies.get(row.id);
      if (id === undefined) throw new Error('Missing declared body identity');
      this.slots.set(id, { row, body: null, actor: null, visible: true, yaw: row.yaw });
    }
    // Static targets must already exist; no duplicate body or collider is made.
    for (const row of rows.colliders) if (row.target.kind === 'box' && staticBoxCollider(this.physics(), row.target.box) === null) throw new Error('Declared collider requires its original baked box');
    this.captureCleanup();
  }
  /** Prepare native species models before any guest can spawn. No actor is
   * allocated at install time and an invalid declaration publishes nothing. */
  static async install(owner: Owner, input: unknown): Promise<DeclaredBodyOps> {
    const rows = v.parse(DeclaredBodyOpsSchema, input);
    if (owner.scope.disposed) throw new Error('Declared bodies require a live owner');
    const actors = rows.bodies.filter(row => row.kind === 'actor');
    if (actors.length > 0) {
      if ('physics' in owner) throw new Error('Declared species actors are client-only');
      const manager = owner.game.runtime?.play?.animals;
      if (manager === undefined) throw new Error('Declared actors require the entered native manager');
      await owner.scope.run(() => manager.factory.prepareModels(actors.map(row => ({ kind: row.species, variant: row.variant }))));
      requireLive(owner);
      owner.scope.run(() => {
        for (const row of actors) if (manager.factory.model(row.species, row.variant).variant !== row.variant) throw new Error('Undeclared species variant');
      });
    }
    return new DeclaredBodyOps(owner, rows);
  }
  private captureCleanup(): void {
    this.forgetCleanup?.();
    // Run before native handle captures, which were registered by the spawn.
    this.forgetCleanup = this.owner.scope.capture('disposers', () => { this.dispose(); });
  }
  private physics() {
    const physics = this.native?.physics ?? this.page?.app.physics;
    if (physics === undefined || physics === null || this.disposed || this.owner.scope.disposed) throw new Error('Declared body physics unavailable');
    return physics;
  }
  private slot(id: number): Slot {
    const slot = this.slots.get(id);
    if (slot === undefined || this.disposed || this.owner.scope.disposed) throw new Error('Unknown declared body');
    return slot;
  }
  private named(id: string): Slot {
    const numeric = this.registries.bodies.get(id);
    if (numeric === undefined) throw new Error('Unknown declared body name');
    return this.slot(numeric);
  }
  /** Native view observation; callers keep their original per-frame animation. */
  actor(id: string): Animal | null { return this.named(id).actor; }
  /** Prop view/restoration observation, never an authored native handle. */
  body(id: string): Body | null { return this.named(id).body; }
  visible(id: string): boolean { return this.named(id).visible; }
  position(id: string): Readonly<{ x: number; y: number; z: number }> | null {
    const slot = this.named(id); return slot.actor?.position ?? (slot.body?.alive === true ? slot.body.rb.translation() : null);
  }
  /** DecisionWorld read port; capability ownership is checked by DecisionHost. */
  read(op: number, id: number, reserved: number): number {
    if (reserved !== 0) throw new Error('Reserved declared body read');
    const slot = this.slot(id), at = slot.actor?.position ?? (slot.body?.alive === true ? slot.body.rb.translation() : null);
    switch (op) {
      case Reads.bodyAlive: return Number(at !== null);
      case Reads.bodyVisible: return Number(at !== null && slot.visible);
      case Reads.bodyYaw: return slot.actor?.yaw ?? slot.yaw;
      case Reads.bodyX: return at?.x ?? slot.row.at.x;
      case Reads.bodyY: return at?.y ?? slot.row.at.y;
      case Reads.bodyZ: return at?.z ?? slot.row.at.z;
      default: throw new Error('Unknown declared body read');
    }
  }
  /** Validate the complete ordered transaction before allocating or mutating.
   * Spawn and placement publish together at the caller's existing commit phase. */
  prepare(commands: readonly ScriptV1Command[]): DecisionCommit {
    if (commands.length > 32) throw new Error('Declared body command bound');
    const pending: (() => void)[] = [], alive = new Map([...this.slots].map(([id, slot]) => [id, slot.actor !== null || slot.body?.alive === true]));
    let spawns = 0;
    for (const [op, actor, a, b, c] of commands) {
      if (![op, actor, a, b, c].every(Number.isFinite)) throw new Error('Nonfinite declared body command');
      if (op === Commands['collider.enabled']) {
        const row = this.rows.colliders.find(entry => this.registries.colliders.get(entry.id) === a);
        if (row === undefined || actor !== 0 || (b !== 0 && b !== 1) || c !== 0) throw new Error('Unknown declared collider command');
        if (row.target.kind === 'body') {
          const bodyId = this.registries.bodies.get(row.target.body);
          if (bodyId === undefined || alive.get(bodyId) !== true) throw new Error('Declared collider body is absent');
        }
        pending.push(() => {
          const target = row.target;
          const collider = target.kind === 'box' ? staticBoxCollider(this.physics(), target.box) : this.named(target.body).body?.collider;
          if (collider === null || collider === undefined) throw new Error('Declared collider no longer exists');
          collider.setEnabled(b === 1);
        });
        continue;
      }
      const id = op === Commands['body.spawn'] ? a : actor, slot = this.slot(id);
      switch (op) {
        case Commands['body.spawn']:
          if (++spawns > 4 || actor !== 0 || b !== 0 || c !== 0 || alive.get(id) === true) throw new Error('Invalid declared body spawn');
          alive.set(id, true); pending.push(() => { this.spawn(slot); }); break;
        case Commands['body.teleport']:
        case Commands['body.place']:
          if (alive.get(id) !== true) throw new Error('Declared body is absent');
          pending.push(() => {
            const at = op === Commands['body.place'] ? { x: a, y: slot.actor?.position.y ?? slot.body?.rb.translation().y ?? slot.row.at.y, z: b } : { x: a, y: b, z: c };
            if (op === Commands['body.place']) slot.yaw = c;
            slot.actor?.place(at.x, at.z, slot.yaw, at.y); slot.body?.teleport(at, upright(slot.yaw));
          }); break;
        case Commands['body.visible']:
          if (alive.get(id) !== true || (a !== 0 && a !== 1) || b !== 0 || c !== 0) throw new Error('Invalid declared visibility');
          pending.push(() => { slot.visible = a === 1; if (slot.actor !== null) { slot.actor.hidden = !slot.visible; slot.actor.mesh.visible = slot.visible; } }); break;
        case Commands['body.retire']:
          if (a !== 0 || b !== 0 || c !== 0) throw new Error('Invalid declared retirement');
          alive.set(id, false); pending.push(() => { this.retire(slot); }); break;
        default: throw new Error('Unknown declared body command');
      }
    }
    let committed = false;
    return { commit: () => {
      if (committed || this.disposed || this.owner.scope.disposed) throw new Error('Declared body commit is no longer live');
      committed = true;
      try { this.owner.scope.run(() => { for (const apply of pending) apply(); }); } finally { this.captureCleanup(); }
    } };
  }
  private spawn(slot: Slot): void {
    const row = slot.row; slot.visible = true; slot.yaw = row.yaw;
    if (row.kind === 'prop') {
      if (this.service === null) throw new Error('Declared prop service unavailable');
      slot.body = this.service.spawn(spec(row), row.at, undefined, upright(row.yaw));
    } else {
      const manager = this.page?.game.runtime?.play?.animals;
      if (manager === undefined) throw new Error('Declared actor manager unavailable');
      const actor = manager.spawn(row.species, row.at.x, row.at.z, row.yaw, row.variant, { y: row.at.y });
      const index = manager.animals.indexOf(actor); if (index !== -1) manager.animals.splice(index, 1);
      actor.herd = -1; actor.setDrawLod(0); slot.actor = actor;
    }
  }
  private retire(slot: Slot): void {
    if (slot.actor !== null) this.page?.game.runtime?.play?.animals.retire(slot.actor);
    if (slot.body?.alive === true) this.service?.remove(slot.body);
    slot.actor = null; slot.body = null;
  }
  /** The native caller retains its original pre/post-world phases. Page props
   * already run through the installed service, so these do nothing on pages. */
  pre(dt: number): void { if (this.native !== null) this.service?.pre(dt); }
  post(dt: number): void { if (this.native !== null) this.service?.post(dt); }
  /** Caller-owned old save handles rebind only after native physics restoration;
   * no script replay, new continuation envelope or extra body is introduced. */
  restoreHandles(handles: Readonly<Record<string, number | null>>): void {
    if (this.native === null) throw new Error('Only native props restore physics handles');
    const physics = this.physics(), next: { slot: Slot; handle: number | null }[] = [], seen = new Set<number>();
    for (const slot of this.slots.values()) {
      const handle = handles[slot.row.id];
      if (slot.row.kind !== 'prop' || handle === undefined || (handle !== null && (!Number.isFinite(handle) || seen.has(handle) || !physics.world.bodies.contains(handle)))) throw new Error('Invalid declared body restoration');
      if (handle !== null) {
        const rb = physics.world.getRigidBody(handle);
        if (rb.numColliders() !== 1) throw new Error('Restored prop collision owner changed');
        const tag = physics.colliderTag(rb.collider(0)), owner = tag?.owner;
        if (tag?.material !== slot.row.material || typeof owner !== 'object' || owner === null
          || !('kind' in owner) || !('id' in owner) || owner.kind !== slot.row.owner.kind || owner.id !== slot.row.owner.id) throw new Error('Restored prop owner changed');
        seen.add(handle);
      }
      next.push({ slot, handle });
    }
    if (Object.keys(handles).length !== next.length) throw new Error('Unknown restored body identity');
    this.service = new Bodies(physics, this.native.player.position);
    for (const { slot, handle } of next) {
      slot.body = handle === null ? null : new Body(physics.world.getRigidBody(handle), physics.world.getRigidBody(handle).collider(0), spec(slot.row), 0);
      if (slot.body !== null) this.service.list.push(slot.body);
    }
  }
  private dispose(): void {
    if (this.disposed) return;
    for (const slot of this.slots.values()) this.retire(slot);
    this.disposed = true;
  }
}
/** Prepare the declared native body host in its existing entered/session scope. */
export function installDeclaredBodyOps(owner: Owner, input: unknown): Promise<DeclaredBodyOps> { return DeclaredBodyOps.install(owner, input); }
