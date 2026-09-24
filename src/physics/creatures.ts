/**
 * Creatures in the physics world (PHYSICS.md P6):
 * - **hitboxes** — every live, shown animal has a head ball and a body capsule (`HITBOX` group), posed from its bones
 *   every update. Weapons find animals by casting against them (`CreatureBodies.cast`), so a wall between the shooter
 *   and the animal is simply the nearer hit.
 * - **bodies** — animals near the player (the creature physics LOD: within NEAR m, released past FAR) get a
 *   `CharacterMotor` capsule: their walk, charge and knock-back move through it, so they stop at walls, rocks,
 *   trunks, the player and each other. Far animals move as before (nobody sees them; 140 Pine Hollow animals on
 *   controllers would blow the phone's physics budget).
 */
import * as THREE from 'three';
import type { Collider } from '@dimforge/rapier3d-simd';
import type { Physics } from './Physics';
import { CharacterMotor } from './CharacterMotor';
import { groups, queryGroups } from './groups';
import { tagCollider, tagOf } from './surface';

/** What the physics needs of an animal (src/entities/Animal.ts implements it). */
export interface Creature {
  readonly position: THREE.Vector3;
  readonly alive: boolean;
  readonly hidden: boolean;
  readonly scale: number;
  readonly dims: { readonly headRadius: number; readonly bodyRadius: number; readonly bodyHalfLen: number; readonly bodyY: number };
  headWorld: (out: THREE.Vector3) => THREE.Vector3;
  bodyCapsule: (a: THREE.Vector3, b: THREE.Vector3) => void;
  /** set by CreatureBodies while the animal is near: its moves go through this */
  motor: CharacterMotor | null;
  /** another body carries it (the ridden horse, on Mount's motor): no creature body of its own */
  readonly driven: boolean;
}

/** The owner tag on a hitbox: which animal, which part. */
export interface HitboxOwner<C extends Creature = Creature> { creature: C; part: 'head' | 'body' }

export interface CreatureHit<C extends Creature = Creature> { creature: C; head: boolean; distance: number; point: THREE.Vector3 }

const NEAR = 45, FAR = 55;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();

interface Boxes { head: Collider; body: Collider; bodyHalf: number; on: boolean }

export class CreatureBodies<C extends Creature = Creature> {
  private readonly boxes = new Map<C, Boxes>();
  private readonly hitGroups = queryGroups(['HITBOX'], 'PROJECTILE');
  private readonly hitPoint = new THREE.Vector3();
  private result: CreatureHit<C> | null = null;
  /** skips a hitbox whose creature is hidden right now — the colliders only turn off at the next sync, and pastRidden
   *  (src/player/riding.ts) hides the ridden horse for the one call, so a rider never aims at / shoots his own mount */
  private readonly shown = (col: Collider): boolean => { const o = tagOf(col)?.owner as HitboxOwner<C> | undefined; return o === undefined || !o.creature.hidden; };
  /** how many creatures had a body (a controller) at the last sync — the bench reads it */
  bodies = 0;

  constructor(private readonly physics: Physics) {}

  /** Every AnimalManager update: pose every hitbox from the bones, hand out / take back bodies by distance to `player`. */
  sync(creatures: readonly C[], player: THREE.Vector3): void {
    const { R, world } = this.physics;
    let bodies = 0;
    for (const c of creatures) {
      let b = this.boxes.get(c);
      const live = c.alive && !c.hidden;
      if (!b) {
        const s = c.scale, d = c.dims;
        const head = world.createCollider(R.ColliderDesc.ball(d.headRadius * s).setCollisionGroups(groups('HITBOX')));
        const bodyHalf = Math.max(0.01, d.bodyHalfLen * s);
        const body = world.createCollider(R.ColliderDesc.capsule(bodyHalf, d.bodyRadius * s).setCollisionGroups(groups('HITBOX')));
        tagCollider(head, 'flesh', { creature: c, part: 'head' } satisfies HitboxOwner<C>);
        tagCollider(body, 'flesh', { creature: c, part: 'body' } satisfies HitboxOwner<C>);
        b = { head, body, bodyHalf, on: true };
        this.boxes.set(c, b);
      }
      if (live !== b.on) { b.on = live; b.head.setEnabled(live); b.body.setEnabled(live); }
      if (live) {
        c.headWorld(_a);
        b.head.setTranslation(_a);
        c.bodyCapsule(_a, _b);
        _d.subVectors(_b, _a);
        const len = _d.length();
        if (len > 1e-4) { _q.setFromUnitVectors(_up, _d.multiplyScalar(1 / len)); b.body.setRotation(_q); }
        b.body.setTranslation({ x: (_a.x + _b.x) / 2, y: (_a.y + _b.y) / 2, z: (_a.z + _b.z) / 2 });
      }
      // the creature physics LOD
      const dist = Math.hypot(c.position.x - player.x, c.position.z - player.z);
      if (c.motor === null && live && dist < NEAR && !c.driven) c.motor = this.motorFor(c);
      else if (c.motor !== null && (!live || dist > FAR || c.driven)) { c.motor.dispose(); c.motor = null; }
      if (c.motor !== null) bodies++;
    }
    this.bodies = bodies;
  }

  private motorFor(c: C): CharacterMotor {
    const s = c.scale, d = c.dims;
    const radius = THREE.MathUtils.clamp(Math.min(d.bodyRadius, d.bodyHalfLen) * s, 0.12, 0.9);
    const height = Math.max(radius * 2 + 0.05, (d.bodyY + d.bodyRadius) * s);
    return new CharacterMotor(this.physics, { radius, height, step: 0.3 * Math.max(1, s), maxClimbDeg: 45, snap: 0.3, group: 'CREATURE', blockedBy: ['WORLD', 'PLAYER', 'CREATURE'], owner: c });
  }

  /** The nearest head / body along the ray within `maxDist` (the returned object is reused). */
  cast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): CreatureHit<C> | null {
    const { R, world } = this.physics;
    const hit = world.castRay(new R.Ray(origin, dir), maxDist, true, R.QueryFilterFlags.EXCLUDE_SENSORS, this.hitGroups, undefined, undefined, this.shown);
    if (!hit) return null;
    const owner = tagOf(hit.collider)?.owner as HitboxOwner<C> | undefined;
    if (owner === undefined) return null;
    const r = this.result ??= { creature: owner.creature, head: false, distance: 0, point: this.hitPoint };
    r.creature = owner.creature; r.head = owner.part === 'head'; r.distance = hit.timeOfImpact;
    r.point.copy(origin).addScaledVector(dir, hit.timeOfImpact);
    return r;
  }

  /** A creature left the world (despawned): drop its colliders. */
  remove(c: C): void {
    const b = this.boxes.get(c);
    if (!b) return;
    this.physics.world.removeCollider(b.head, false); this.physics.world.removeCollider(b.body, false);
    this.boxes.delete(c);
    if (c.motor !== null) { c.motor.dispose(); c.motor = null; }
  }
}
