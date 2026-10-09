import * as THREE from 'three';
import { CHUNK_HALF, SEED } from '@wildshard/engine/core/config';
import { smoothstep } from '@wildshard/engine/core/noise';
import { Rng } from '@wildshard/engine/core/rng';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import type { CullOptions, CullView } from '@wildshard/engine/models/cull';
import type { Placement } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import type { Renderer } from '@wildshard/engine/render/renderer';
import type { TreeInstance } from '@wildshard/engine/world/forest/placement';
import { normalAt, trailDistance, cabinMask, inChunk, CABIN_SITES, TRAILS } from '@wildshard/engine/world/Heightfield';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { BOULDER_SHAPES, ROCK_SOLID_ABOVE, boulderSizes, loadMossyBoulder, mossyBoulder, type MossyBoulderParams } from '../models/mossyBoulder';
import { loadTreeStump, treeStump } from '../models/treeStump';
import { fallenLog, fallenLogSize, loadFallenLog } from '../models/fallenLog';
import { pineModels } from './context';
import { inEntryLanes } from './entryLanes';
import source from '../shard.config';

/**
 * Pine Hollow's forest props (E315 M2: the scatter; the things are models in ../models/): mossy boulders
 * (`pine-hollow/mossy-boulder`, six shapes), cut stumps (`pine-hollow/tree-stump`) and fallen logs
 * (`pine-hollow/fallen-log`), all Poly Haven CC0 photoscans.
 *
 *   const props = new Props(sky, forest, renderer);
 *   await props.build(registry, macrotask);      // places and registers them; `registry` null: a dev page / the bake
 *   props.place(registry);   // the legacy boxes (large boulders only: the melee sweep)
 *
 * Placement is deterministic (Rng(SEED+…)), follows the terrain normal, sinks into the ground, avoids tree trunks via
 * `forest.nearby`, keeps off the trails (trailDistance > 4 for logs) and out of the cabin pads (cabinMask < 0.2,
 * stumps excepted). Drawing is `place`'s: the six rock shapes share the scan's material, so they are ONE BatchedMesh
 * where multi-draw exists (one InstancedMesh per shape without), stumps and logs one InstancedMesh per scan part; every
 * copy is culled by range, angular size and the forest's padded view frustum (`cull.view`: the forest's buckets refill).
 *
 * PHYSICS P3: rocks showing more than ROCK_SOLID_ABOVE above the ground and every stump collide as the hull of their
 * support points, fallen logs as one capsule lying along the log (the models' own-space colliders, placed per copy).
 */

/** what the scatter needs of the forest: its trunks, and its view (the props' copies follow the forest's buckets) */
export interface PropsForest extends CullView {
  trees: readonly TreeInstance[];
  nearby: (x: number, z: number, r?: number) => TreeInstance[];
}

export class Props {
  /** what the dev page / the bake add to a scene (registered builds are added by the registry) */
  readonly group = new THREE.Group();
  /** legacy boxes (large boulders only) for the melee sweep */
  colliders: Collider[] = [];
  counts = { rocks: 0, stumps: 0, logs: 0 };
  /** the three place calls: boulders, stumps, logs */
  readonly placed: Placed[] = [];

  constructor(private sky: Sky, private forest: PropsForest, private renderer: Renderer | null = null) {}

  /** load the scans, scatter them and place them — registered on `registry` (the colliders a task apart), or only built */
  async build(registry: WorldRegistry | null = null, yieldTask: () => Promise<void> = () => Promise.resolve()): Promise<THREE.Group> {
    const ctx = pineModels(this.sky, this.renderer);
    await Promise.all([loadMossyBoulder(ctx), loadTreeStump(ctx), loadFallenLog(ctx)]);
    const cull: CullOptions = { far: TIER_CONFIG.propsFar, keepNear: 40, minAngular: TIER_CONFIG.propsMinAngular, view: this.forest, bounds: 'sphere' };
    const rocks = this.rocks(boulderSizes(ctx));
    const solid = rocks.filter((p) => p.params?.solid === true).length;
    // P3: rocks and stumps as hulls, logs as capsules — the rocks' hulls in two pieces a task apart, the wood in a third
    // (the phone's 30 ms per-task collider budget)
    const boulders = place(mossyBoulder, rocks, { ctx, draw: 'batched', sortObjects: false, cull, registry,
      piece: { id: 'props', split: { every: Math.max(1, Math.ceil(solid / 2)), yieldTask } } });
    await boulders.registered;
    await yieldTask();
    const stumps = place(treeStump, this.stumps(), { ctx, draw: 'instanced', cull, registry, piece: { id: 'props-stumps' } });
    const logs = place(fallenLog, this.logs(fallenLogSize(ctx)), { ctx, draw: 'instanced', cull, registry, piece: { id: 'props-wood' } });
    this.placed.push(boulders, stumps, logs);
    if (registry === null) this.group.add(boulders.object, stumps.object, logs.object);
    return this.group;
  }

  /** every placed collider, world space (the navmesh bake) */
  colliderDescs(): ColliderDesc[] { return this.placed.flatMap((p) => p.colliders); }

  /** a random point on a random trail segment */
  private trailPoint(rng: Rng): [number, number] {
    const poly = rng.pick(TRAILS), i = rng.int(0, poly.length - 2), t = rng.next();
    const a = poly[i], b = poly[i + 1];
    if (!a || !b) throw new Error('[props] trail polyline shorter than 2 points');
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }

  private treeFree(x: number, z: number, r: number): boolean {
    for (const t of this.forest.nearby(x, z, r)) if (Math.hypot(t.x - x, t.z - z) < t.r + r) return false;
    return true;
  }

  /** compose a matrix that sits an object on the terrain, aligned to the normal, yawed and scaled */
  private static place(x: number, z: number, yaw: number, scale: number, sink: number, tilt = 1, out = new THREE.Matrix4()): THREE.Matrix4 {
    const [nx, ny, nz] = normalAt(x, z, 1.0);
    const up = new THREE.Vector3(nx, ny, nz).lerp(new THREE.Vector3(0, 1, 0), 1 - tilt).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    return out.compose(new THREE.Vector3(x, heightAt(x, z) - sink, z), q, new THREE.Vector3(scale, scale, scale));
  }

  /** a placement at a composed matrix */
  private static at<P extends object>(m: THREE.Matrix4, extra: Omit<Placement<P>, 'x' | 'y' | 'z' | 'matrix'> = {}): Placement<P> {
    const e = m.elements;
    return { x: e[12], y: e[13], z: e[14], matrix: m, ...extra };
  }

  // ── boulders: the six shapes of rock_moss_set_01, each on its own base ──
  private rocks(sizes: readonly { radius: number; height: number }[]): Placement<MossyBoulderParams>[] {
    const rng = new Rng(SEED + 201);
    const shapes = sizes.map((s, k) => ({ ...s, k }));
    /** per shape, in scatter order: the batch / instance order the old builder drew in */
    const byShape: Placement<MossyBoulderParams>[][] = shapes.map(() => []);
    let n = 0, tries = 0, gated = 0;
    while (n < 380 && tries++ < 30000) {
      // half the boulders line the trails (where the player actually walks), the rest follow the slopes
      let x: number, z: number;
      const nearTrail = rng.next() < 0.5;
      if (nearTrail) { const p = this.trailPoint(rng); const a = rng.range(0, Math.PI * 2), d = rng.range(3.5, 16); x = p[0] + Math.cos(a) * d; z = p[1] + Math.sin(a) * d; }
      else { x = rng.range(-244, 244); z = rng.range(-244, 244); }
      if (!inChunk(x, z, 6) || cabinMask(x, z) > 0.2) continue;
      const td = trailDistance(x, z);
      if (td < 3) continue;
      const [, ny] = normalAt(x, z, 1.0);
      const slope = 1 - ny;
      // rocks favour slopes and the rocky ridges; a sprinkle everywhere
      if (!nearTrail && rng.next() > 0.18 + 0.82 * smoothstep(0.04, 0.3, slope)) continue;
      const shape = rng.pick(shapes);
      // log-distributed size: mostly knee-high, a few car-sized
      const scale = Math.exp(rng.range(Math.log(0.3), Math.log(1.7)));
      const r = shape.radius * scale;
      if (!this.treeFree(x, z, r * 0.6)) continue;
      if (td < r + 2) continue;
      const sink = shape.height * scale * (0.18 + 0.35 * smoothstep(0.05, 0.3, slope) + rng.range(0, 0.1));
      const m = Props.place(x, z, rng.range(0, Math.PI * 2), scale, sink, 0.85);
      const above = shape.height * scale - sink;                  // height showing above ground
      // a solid boulder standing in a declared entry's lanes is left out (its draws taken and its slot counted, so the rest
      // of the scatter stands exactly where it was): a player walking in from the grid's road meets nothing in the canyon
      if (above > ROCK_SOLID_ABOVE && inEntryLanes(source.entryways, CHUNK_HALF, x, z)) { n++; gated++; continue; }
      byShape[shape.k]?.push(Props.at(m, { variant: BOULDER_SHAPES[shape.k] ?? 'a', params: { solid: above > ROCK_SOLID_ABOVE } }));
      if (above > 1.0) this.colliders.push({ x, z, hw: r * 0.6, hd: r * 0.6, rot: 0, yTop: heightAt(x, z) + above, yBottom: heightAt(x, z) - 1 });
      n++;
    }
    this.counts.rocks = n - gated;
    return byShape.flat();
  }

  // ── stumps: along the trails and around the cabins, as if cut for firewood ──
  private stumps(): Placement<Record<string, never>>[] {
    const rng = new Rng(SEED + 202);
    const out: Placement<Record<string, never>>[] = [];
    let tries = 0, gated = 0;
    while (out.length + gated < 70 && tries++ < 20000) {
      let x: number, z: number;
      if (rng.next() < 0.4) {
        const c = rng.pick(CABIN_SITES);
        const a = rng.range(0, Math.PI * 2), d = rng.range(9, 22);
        x = c.x + Math.cos(a) * d; z = c.z + Math.sin(a) * d;
      } else { const p = this.trailPoint(rng); const a = rng.range(0, Math.PI * 2), d = rng.range(3.5, 14); x = p[0] + Math.cos(a) * d; z = p[1] + Math.sin(a) * d; }
      if (!inChunk(x, z, 6)) continue;
      const td = trailDistance(x, z);
      if (td < 3.5 || (td > 14 && cabinMask(x, z) < 0.02)) continue;
      if (cabinMask(x, z) > 0.75) continue;                       // not on the pad itself
      const [, ny] = normalAt(x, z, 1.0);
      if (ny < 0.8) continue;
      if (!this.treeFree(x, z, 1.2)) continue;
      const scale = rng.range(0.8, 1.35), m = Props.place(x, z, rng.range(0, Math.PI * 2), scale, 0.06 * scale, 0.7);
      // every stump collides: one standing in a declared entry's lanes is left out, its draws taken and its slot counted
      if (inEntryLanes(source.entryways, CHUNK_HALF, x, z)) { gated++; continue; }
      out.push(Props.at(m));
    }
    this.counts.stumps = out.length;
    return out;
  }

  // ── fallen logs: lying along the slope, near trail edges but never on them ──
  private logs(size: { halfLen: number; bottom: number }): Placement<Record<string, never>>[] {
    const rng = new Rng(SEED + 203);
    const out: Placement<Record<string, never>>[] = [];
    const { halfLen, bottom } = size;
    let tries = 0;
    while (out.length < 55 && tries++ < 30000) {
      let x: number, z: number;
      if (rng.next() < 0.7) { const p = this.trailPoint(rng); const a = rng.range(0, Math.PI * 2), d = rng.range(4.5, 12); x = p[0] + Math.cos(a) * d; z = p[1] + Math.sin(a) * d; }
      else { x = rng.range(-240, 240); z = rng.range(-240, 240); }
      if (!inChunk(x, z, 7) || cabinMask(x, z) > 0.2) continue;
      const td = trailDistance(x, z);
      if (td < 4.5) continue;
      const [nx, ny, nz] = normalAt(x, z, 1.0);
      if (ny < 0.75) continue;
      const scale = rng.range(1.1, 1.8), hl = halfLen * scale;
      // orientation: mostly along the fall line, some random
      const yaw = rng.next() < 0.6 ? Math.atan2(-nz, nx) + rng.range(-0.5, 0.5) : rng.range(0, Math.PI * 2);
      const dx = Math.cos(yaw), dz = -Math.sin(yaw);               // local +X after yaw
      const ax = x + dx * hl, az = z + dz * hl, bx = x - dx * hl, bz = z - dz * hl;
      if (trailDistance(ax, az) < 4 || trailDistance(bx, bz) < 4) continue;
      if (!this.treeFree(x, z, 0.5) || !this.treeFree(ax, az, 0.4) || !this.treeFree(bx, bz, 0.4)) continue;
      // lie along the ground: pitch from the end heights, roll random
      const ya = heightAt(ax, az), yb = heightAt(bx, bz);
      // a log bridges concave ground on its ends and balances on convex ground in the middle: rest on the higher of the two
      const ym = Math.max((ya + yb) / 2, heightAt(x, z), (heightAt((x + ax) / 2, (z + az) / 2) + heightAt((x + bx) / 2, (z + bz) / 2)) / 2);
      const pitch = Math.atan2(ya - yb, 2 * hl);            // Rz(+pitch) lifts the +X end
      // roll happens around the log axis (local X): apply after yaw+pitch
      const qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rng.range(0, Math.PI * 2));
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, pitch, 'YXZ')).multiply(qRoll);
      // the terrain mesh is ~2 m per vertex, so lift thin logs a little above the analytic height rather than let them sink
      out.push(Props.at(new THREE.Matrix4().compose(new THREE.Vector3(x, ym - bottom * scale + 0.14 * scale, z), q, new THREE.Vector3(scale, scale, scale))));
    }
    this.counts.logs = out.length;
    return out;
  }
}
