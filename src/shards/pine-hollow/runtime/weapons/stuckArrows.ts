import * as v from 'valibot';
import { Vector3 } from 'three';
import { projectileBury, projectileDrop, projectileRest, projectileWithinReach } from '@wildshard/engine/combat/projectileContact';

const CAPACITY = 48, LENGTH = 0.76, BURY = 0.09, RADIUS = 0.02, RECOVER_UP = 2.1;
const REACH = { radius: 1.25, up: RECOVER_UP, down: 1.2 };
const Y = new Vector3(0, 1, 0), X = new Vector3(1, 0, 0);
const finite = v.pipe(v.number(), v.finite()), vec = v.tuple([finite, finite, finite]);
export const STUCK_ARROWS_SAVED = v.strictObject({ version: v.literal(1), frame: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER)),
  stuck: v.pipe(v.array(v.strictObject({ position: vec, direction: vec, body: v.nullable(v.string()), local: vec, localDirection: vec, recoverable: v.boolean() })), v.maxLength(CAPACITY)) });
type StuckSnapshot = v.InferOutput<typeof STUCK_ARROWS_SAVED>;

/** The attachment's yaw frame, exactly the default TargetAnimal frame used by the live projectile pool. */
export interface ArrowBody { readonly entityId: string; readonly position: Vector3; readonly yaw: number; readonly alive: boolean; readonly hidden?: boolean }
export interface StuckArrowPorts {
  readonly feet: Vector3;
  readonly floorAt: (x: number, y: number, z: number) => number;
  readonly body: (id: string) => ArrowBody | undefined;
  readonly canRecover: () => boolean;
  readonly recover: (survived: boolean) => void;
  readonly random: () => number;
}
interface StuckArrow { position: Vector3; direction: Vector3; body: string | null; local: Vector3; localDirection: Vector3; recoverable: boolean }

/** Bounded renderer-free continuation of Pine's stopped shafts. Queries and survival draws belong to the one host.
 * `update` is one projectile update, not elapsed seconds: shipping recovery checks every eighth update. */
export class PineStuckArrows {
  private readonly ports: StuckArrowPorts;
  private frame = 0;
  private readonly stuck: StuckArrow[] = [];
  private readonly free: StuckArrow[] = Array.from({ length: CAPACITY }, () => ({ position: new Vector3(), direction: new Vector3(),
    body: null, local: new Vector3(), localDirection: new Vector3(), recoverable: true }));
  private readonly along = new Vector3();
  constructor(ports: StuckArrowPorts) { this.ports = ports; }
  get count(): number { return this.stuck.length; }

  stop(point: Vector3, direction: Vector3, flesh: boolean, body: ArrowBody | null): void {
    const slot = this.takeSlot();
    if (slot === undefined) return;
    projectileBury(point, direction, flesh ? BURY * 2.2 : BURY, slot.position);
    slot.direction.copy(direction); slot.body = body?.entityId ?? null;
    slot.local.set(0, 0, 0); slot.localDirection.set(0, 0, 0); slot.recoverable = true;
    if (body !== null) {
      slot.local.copy(slot.position).sub(body.position).applyAxisAngle(Y, -body.yaw);
      slot.localDirection.copy(direction).applyAxisAngle(Y, -body.yaw);
    } else {
      const midY = slot.position.y - direction.y * LENGTH * 0.5;
      slot.recoverable = midY - this.ports.floorAt(slot.position.x, midY, slot.position.z) < RECOVER_UP - 0.2;
    }
    this.stuck.push(slot);
  }

  rest(point: Vector3, direction: Vector3, normal: Vector3): void {
    const slot = this.takeSlot();
    if (slot === undefined) return;
    slot.position.copy(point);
    projectileRest(slot.position, direction, normal, RADIUS, LENGTH, this.along, Y, X);
    slot.direction.copy(this.along); slot.body = null;
    slot.local.set(0, 0, 0); slot.localDirection.set(0, 0, 0); slot.recoverable = true;
    this.stuck.push(slot);
  }

  /** A killed hit is detached immediately, as Projectiles.testHit does after installing its last stuck slot. */
  dropLast(): void { const slot = this.stuck.at(-1); if (slot !== undefined) this.drop(slot); }

  update(): void {
    for (let n = 0; n < CAPACITY; n++) {
      const i = this.stuck.length - 1 - n;
      const slot = this.stuck[i];
      if (slot === undefined) break;
      if (slot.body === null) continue;
      const body = this.ports.body(slot.body);
      if (body?.alive !== true || body.hidden) { this.drop(slot); continue; }
      slot.position.copy(slot.local).applyAxisAngle(Y, body.yaw).add(body.position);
      slot.direction.copy(slot.localDirection).applyAxisAngle(Y, body.yaw);
    }
    if ((++this.frame & 7) !== 0) return;
    const count = this.stuck.length;
    for (let n = 0; n < CAPACITY; n++) {
      const i = count - 1 - n;
      const slot = this.stuck[i];
      if (slot === undefined) break;
      if (slot.body !== null || !slot.recoverable || !projectileWithinReach(slot.position, slot.direction, LENGTH, this.ports.feet, REACH)) continue;
      if (!this.ports.canRecover()) return;
      this.remove(i);
      this.ports.recover(this.ports.random() < 0.7);
    }
  }

  snapshot(): StuckSnapshot {
    return { version: 1, frame: this.frame, stuck: this.stuck.map(slot => ({ position: [slot.position.x, slot.position.y, slot.position.z],
      direction: [slot.direction.x, slot.direction.y, slot.direction.z], body: slot.body, local: [slot.local.x, slot.local.y, slot.local.z],
      localDirection: [slot.localDirection.x, slot.localDirection.y, slot.localDirection.z], recoverable: slot.recoverable })) };
  }
  restore(value: unknown): void {
    const saved = v.parse(STUCK_ARROWS_SAVED, value);
    for (let i = 0; i < CAPACITY; i++) { if (this.stuck.length === 0) break; this.remove(0); }
    this.frame = saved.frame;
    for (let i = 0; i < CAPACITY; i++) {
      const row = saved.stuck[i];
      if (row === undefined) break;
      const slot = this.free.pop();
      if (slot === undefined) break;
      slot.position.set(...row.position); slot.direction.set(...row.direction); slot.body = row.body;
      slot.local.set(...row.local); slot.localDirection.set(...row.localDirection); slot.recoverable = row.recoverable;
      this.stuck.push(slot);
    }
  }
  private takeSlot(): StuckArrow | undefined {
    if (this.stuck.length >= CAPACITY) this.remove(0);
    return this.free.pop();
  }
  private remove(index: number): void { const slot = this.stuck.splice(index, 1)[0]; if (slot !== undefined) this.free.push(slot); }
  private drop(slot: StuckArrow): void {
    slot.body = null;
    const floor = this.ports.floorAt(slot.position.x, slot.position.y, slot.position.z);
    projectileDrop(slot.position, slot.direction, floor, BURY); slot.recoverable = true;
  }
}
