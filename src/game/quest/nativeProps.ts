import * as v from 'valibot';
import { NativeQuestPropsSchema } from '@wildshard/format/questInteractions';
import type { SimHost } from '@wildshard/engine/sim';
import { Bodies, Body } from '@wildshard/engine/physics/bodies';
import { BARREL_BODY, BARREL_HALF, BarrelWatch, barrelAtPlate, type BarrelEnv } from '@wildshard/engine/world/interact/barrel';
import { test } from '@wildshard/engine/world/interact/flags';

const finite = v.pipe(v.number(), v.finite()), point = v.strictObject({ x: finite, y: finite, z: finite });
const savedBody = v.nullable(v.strictObject({ handle: v.pipe(finite, v.minValue(0)),
  watch: v.strictObject({ lost: finite, wedge: finite, from: point }) }));
type Collider = ReturnType<SimHost['physics']['world']['getCollider']>;

/** Renderer-free physical props. Authored rows are the entire content API;
 * body services, native handles, flags and ground resolve from the real host. */
export class NativeQuestProps {
  private readonly rows;
  private service: Bodies;
  private readonly barrels;
  private gates: (Collider | null)[];
  private readonly walk = { x: 0, y: 0, z: 0 };
  private readonly lifted = { x: 0, y: 0, z: 0 };
  private readonly env: BarrelEnv;
  constructor(private readonly host: SimHost, input: unknown, restoring: boolean) {
    this.rows = v.parse(NativeQuestPropsSchema, input);
    if (new Set(this.rows.barrels.map(row => row.id)).size !== this.rows.barrels.length
      || this.rows.floors.some(row => row.values.length !== row.width * row.height)) throw new Error('Invalid native quest prop rows');
    this.service = new Bodies(host.physics, host.player.position);
    this.env = { player: { position: host.player.position, velocity: this.walk }, floorAt: (x, z) => this.floorAt(x, z),
      water: () => this.rows.water, onPlate: at => this.rows.plates.some(row => test(host.flags, row.when) && barrelAtPlate(at, row.at, row.size)) };
    this.barrels = this.rows.barrels.map(row => ({ row, body: null as Body | null, adopt: null as number | null,
      watch: new BarrelWatch(row.home, row.leash), upright: { x: 0, y: Math.sin(row.yaw / 2), z: 0, w: Math.cos(row.yaw / 2) } }));
    this.gates = this.rows.gates.map(() => null);
    if (!restoring) {
      for (const slot of this.barrels) slot.body = this.service.spawn({ ...BARREL_BODY, owner: slot.row.owner }, this.lift(slot.row.home), undefined, slot.upright);
      this.findGates();
    }
    host.scope.onDispose(() => { this.service.dispose(); });
  }
  private lift(at: { readonly x: number; readonly y: number; readonly z: number }) {
    this.lifted.x = at.x; this.lifted.y = at.y + BARREL_HALF + 0.01; this.lifted.z = at.z; return this.lifted;
  }
  /** Captured platform samples layer over the host's native ground. */
  floorAt(x: number, z: number): number {
    let y = this.host.groundHeightAt(x, z);
    for (const grid of this.rows.floors) {
      const ix = Math.round((x - grid.x) / grid.step), iz = Math.round((z - grid.z) / grid.step);
      if (ix < 0 || iz < 0 || ix >= grid.width || iz >= grid.height) continue;
      const sample = grid.values[iz * grid.width + ix]; if (sample !== null && sample !== undefined) y = Math.max(y, sample);
    }
    return y;
  }
  private findGates(): void {
    const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-3;
    this.gates = this.rows.gates.map(({ box }) => {
      const found: Collider[] = [], cy = (box.yTop + box.yBottom) / 2, hy = (box.yTop - box.yBottom) / 2;
      this.host.physics.world.forEachCollider(collider => {
        const at = collider.translation(), half = collider.halfExtents();
        if (half !== null && collider.parent() === null && near(at.x, box.x) && near(at.y, cy) && near(at.z, box.z)
          && near(half.x, box.hw) && near(half.y, hy) && near(half.z, box.hd)) found.push(collider);
      });
      const collider = found[0]; if (collider === undefined) throw new Error('Native quest gate has no baked collider'); return collider;
    });
  }
  /** The caller retains the original post-world/pre-interaction phase. */
  step(dt: number, walk: { readonly x: number; readonly z: number }): void {
    if (this.barrels.length === 0) return;
    this.walk.x = walk.x; this.walk.z = walk.z; this.service.post(dt);
    for (const slot of this.barrels) if (slot.body !== null && slot.watch.check(slot.body.curr, dt, this.env)) {
      slot.body.teleport(this.lift(slot.row.home), slot.upright); slot.watch.clear();
    }
    this.service.pre(dt);
  }
  /** Run after flag transitions, so an opened latch releases in the same tick. */
  syncGates(): void {
    this.rows.gates.forEach((row, i) => { const collider = this.gates[i]; if (this.host.flags.has(row.flag) && collider?.isEnabled() === true) collider.setEnabled(false); });
  }
  snapshot(id: string): v.InferOutput<typeof savedBody> {
    const slot = this.barrels.find(entry => entry.row.id === id);
    return slot?.body === null || slot === undefined ? null : { handle: slot.body.rb.handle, watch: slot.watch.state() };
  }
  restore(id: string, input: unknown): void {
    const state = v.parse(savedBody, input), slot = this.barrels.find(entry => entry.row.id === id);
    if ((state === null) !== (slot === undefined)) throw new Error('Incompatible native quest prop continuation');
    if (state !== null && slot !== undefined) { slot.watch.restore(state.watch); slot.adopt = state.handle; }
  }
  /** Rebind restored handles without spawning, drawing or replaying flag edges. */
  physicsRestored(): void {
    this.service = new Bodies(this.host.physics, this.host.player.position); this.findGates();
    for (const slot of this.barrels) {
      if (slot.adopt === null) continue;
      const world = this.host.physics.world;
      if (!world.bodies.contains(slot.adopt)) throw new Error('Saved native quest prop has no body');
      const rb = world.getRigidBody(slot.adopt), body = new Body(rb, rb.collider(0), { ...BARREL_BODY, owner: slot.row.owner }, 0);
      this.service.list.push(body); slot.body = body; slot.adopt = null;
    }
  }
}
