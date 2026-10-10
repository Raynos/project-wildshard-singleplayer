/**
 * Trailside — the wooden dressing along Driftwood Isle's sand paths: rope fences (posts with a
 * sagging rope), plank steps set into the steeper climbs, and signposts with arrow boards at the
 * forks. Flat-shaded vertex colours, one mesh; fence posts and signposts collide, steps are
 * decoration on the walkable slope.
 *
 * E306 / E315 M1: the fence post, the signpost and the plank step are models
 * (src/shards/driftwood-isle/models/trailside.ts). The trail builds them in its layout's order from one stream, between
 * what is its own — the ropes sagging between the posts, the steps' side rails, the trestle stairs. The offline
 * generator welds these into one baked mesh; this builder admits it and places each model `drawnInto` it
 * (its copies, its card, its colliders: pieces `trail-*`). The trail's
 * own piece (`trailside`, main.ts) keeps the steps' and the stairs' treads (`worldColliderDescs`); `colliderDescs` is
 * the whole trail's, as before (the navmesh bake reads it). A dev page's or the bake's trail registers its models in a
 * registry nothing reads.
 *
 *   const trailside = new Trailside(sky).build(Trailside.forIsland());
 *   scene.add(trailside.mesh); its registry piece.push(...trailside.colliders);
 *
 * `Trailside.forIsland()` is Driftwood's layout: fences along the plateau ramp and the plateau's
 * seaward rim, steps up the plateau ramp and the headland ramp, signposts at the pier landing and
 * the hut fork.
 */
import * as THREE from 'three';
import { modelContext } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { fencePost, plankStep, signpost, trailMaterial } from '../models/trailside';

import { copyTrailsideGeometry } from '../boot/trailsideGeometry';
import { flightOf, islandTrailsideSpec, type TrailsideSpec, type StepsSpec, type FlightSpec } from './trailsideLayout';

/** The placed native trail weld with its existing terrain-following collision law. */
export class Trailside {
  mesh!: THREE.Mesh;
  colliders: Collider[] = [];
  private steps: StepsSpec[] = [];
  private flights: FlightSpec[] = [];
  /** the models placed into the weld: the posts' and signposts' colliders, in the layout's order */
  readonly placed: Placed[] = [];

  constructor(private sky: Sky) {}

  /** Driftwood Isle's layout (see the PATHS / PLATEAU / HEADLAND constants in the def) */
  static forIsland(): TrailsideSpec { return islandTrailsideSpec(); }

  /** the game's: the trail's own piece (`trailside`: its weld drawn, its steps' and stairs' treads) after its models' */
  place(registry: WorldRegistry): this {
    registry.add({ id: 'trailside', name: 'Trailside', category: 'props', file: 'src/shards/driftwood-isle/world/Trailside.ts', object: this.mesh, colliders: this.worldColliderDescs(), surface: 'wood', solidFloor: true });
    return this;
  }

  /** the models placed (pieces `trail-fence-posts`, `trail-signposts`, `trail-steps`) and the weld built */
  build(spec: TrailsideSpec): this {
    const { geometry: geo, metadata } = copyTrailsideGeometry(spec);
    const ctx = modelContext(this.sky), { posts, signs, planks } = metadata;
    this.steps = spec.steps; this.flights = spec.flights ?? [];
    this.colliders.push(...metadata.colliders);
    this.mesh = new THREE.Mesh(geo, trailMaterial(ctx));
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    const into = (boxes: number[]): { object: THREE.Mesh; boxes: Float32Array } => ({ object: this.mesh, boxes: Float32Array.from(boxes) });
    // the posts' colliders, then the signposts' (the order the trail's boxes always had)
    if (posts.pls.length > 0) this.placed.push(place(fencePost, posts.pls, { ctx, draw: 'merged', drawnInto: into(posts.boxes), piece: { id: 'trail-fence-posts' } }));
    if (signs.pls.length > 0) this.placed.push(place(signpost, signs.pls, { ctx, draw: 'merged', drawnInto: into(signs.boxes), piece: { id: 'trail-signposts' } }));
    if (planks.pls.length > 0) this.placed.push(place(plankStep, planks.pls, { ctx, draw: 'merged', drawnInto: into(planks.boxes), piece: { id: 'trail-steps' } }));
    return this;
  }

  /**
   * PHYSICS P4: this builder's static collision in world space — the fence posts and signposts (the legacy boxes)
   * and, walkable for the first time, the plank steps. src/engine/physics/pieces.ts turns it into Rapier colliders.
   */
  colliderDescs(): ColliderDesc[] {
    const out: ColliderDesc[] = this.placed.flatMap((p) => p.colliders);
    out.push(...this.worldColliderDescs());
    return out;
  }

  /** the trail's own collision (its piece `trailside`): the plank steps' treads and the trestle stairs'; the posts and
   *  signposts collide as their models (pieces `trail-fence-posts`, `trail-signposts`) */
  worldColliderDescs(): ColliderDesc[] {
    const out: ColliderDesc[] = [];
    for (const s of this.steps) out.push(...stepTreads(s));
    for (const f of this.flights) {
      const fl = flightOf(f, heightAt), { ux, uz, sx, sz, w, m } = fl;
      // the treads (solid down to the foot of the flight), and a rail each side along the slope, 1.1 m over them
      out.push({ kind: 'treads', from: { x: f.bottom[0], y: fl.yb, z: f.bottom[1] }, to: { x: f.bottom[0] + ux * fl.len, y: fl.yt, z: f.bottom[1] + uz * fl.len }, width: w, count: m });
      const pitch = Math.atan2(fl.yt - fl.yb, fl.len), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, Math.atan2(ux, uz), 0, 'YXZ'));
      for (const s of [-1, 1]) {
        const ac = s * (w / 2 + 0.07), mx = f.bottom[0] + ux * fl.len / 2 + sx * ac, mz = f.bottom[1] + uz * fl.len / 2 + sz * ac;
        out.push({ kind: 'box', x: mx, y: (fl.yb + fl.yt) / 2 + 0.55, z: mz, hx: 0.06, hy: 0.6, hz: Math.hypot(fl.len, fl.yt - fl.yb) / 2, rot: { x: q.x, y: q.y, z: q.z, w: q.w } });
      }
    }
    return out;
  }
}

/**
 * The character's stair rule (CharacterMotor: 0.38 m capsule, autostep 0.35 m), measured on Rapier: a tread under
 * 0.35 m deep lets the capsule's sphere rest on the next tread's edge at a 45° contact and it jams, whatever the rise;
 * from 0.354 m deep it climbs every rise to 0.33 m. So: treads ≥ 0.354 m deep, risers ≤ 0.32 m.
 */
const TREAD_RUN = 0.354, TREAD_RISE = 0.32, MAX_LIFT = 0.3;

/**
 * A flight of plank steps as solid treads. The planks follow the ground (a plank every ~0.7 m, its top 9 cm over
 * `heightAt` at its centre), and the plateau ramp's ground climbs at up to ~46° (0.73 m from one plank to the next),
 * past the character's 40° / 0.35 m. So the flight is cut into equal treads ≥ 0.354 m deep (two per plank gap), each
 * at the plank line (the drawn plank tops, joined) or 3 cm over the ground under its middle 1.2 m (where the capsule
 * walks), whichever is higher, so no slope between two planks pokes through as a wedge the capsule can't climb. Where
 * that still leaves a riser over 0.32 m (the 46° stretch rises ~0.37 m a tread) the treads before it are lifted, by at
 * most 0.3 m, until every riser is ≤ 0.32 m: the stair eases into the steep bit a little above the planks. A riser that
 * needs more lift than that is a cliff (the headland flight crosses two, 1–1.9 m between planks) and stays a wall, as
 * the ground is. Every tread is a solid box down to 0.3 m under the lowest ground at its corners, so none floats.
 */
function stepTreads(s: StepsSpec): ColliderDesc[] {
  const w = s.width ?? 2.4, hx = w / 2;
  const dx = s.to[0] - s.from[0], dz = s.to[1] - s.from[1], len = Math.hypot(dx, dz), n = Math.floor(len / 0.7);
  if (n < 1) return [];
  const ux = dx / len, uz = dz / len, yaw = Math.atan2(dx, dz), gap = len / n;
  const ground = (al: number, ac: number) => heightAt(s.from[0] + ux * al + uz * ac, s.from[1] + uz * al - ux * ac);
  const plank: number[] = [];
  for (let i = 0; i <= n; i++) plank.push(ground(gap * i, 0) + 0.09);   // the drawn plank: y + 0.02, 0.14 thick
  const plankLine = (al: number) => {
    const f = Math.min(n, Math.max(0, al / gap)), i = Math.min(n - 1, Math.floor(f)), t = f - i;
    return (plank[i] ?? 0) * (1 - t) + (plank[i + 1] ?? 0) * t;
  };
  // equal treads from the first plank's front edge to the last plank's back edge
  const start = -0.21, span = len + 0.42, m = Math.max(1, Math.floor(span / TREAD_RUN)), run = span / m;
  const need: number[] = [], top: number[] = [];
  for (let i = 0; i < m; i++) {
    const a = start + i * run, b = a + run;
    let y = plankLine(a + run / 2);
    for (const al of [a, a + run / 2, b]) for (const ac of [-0.6, 0, 0.6]) y = Math.max(y, ground(al, ac) + 0.03);
    need.push(y); top.push(y);
  }
  // ease the steep bits: lift a tread (≤ MAX_LIFT) so neither neighbour is more than TREAD_RISE above it
  for (let i = 1; i < m; i++) top[i] = Math.min((need[i] ?? 0) + MAX_LIFT, Math.max(top[i] ?? 0, (top[i - 1] ?? 0) - TREAD_RISE));
  for (let i = m - 2; i >= 0; i--) top[i] = Math.min((need[i] ?? 0) + MAX_LIFT, Math.max(top[i] ?? 0, (top[i + 1] ?? 0) - TREAD_RISE));
  const out: ColliderDesc[] = [];
  for (let i = 0; i < m; i++) {
    const a = start + i * run, b = a + run, y = top[i] ?? 0, mid = (a + b) / 2;
    let lo = y;
    for (const al of [a, b]) for (const ac of [-hx, hx]) lo = Math.min(lo, ground(al, ac));
    const hy = (y - (lo - 0.3)) / 2;
    out.push({ kind: 'box', x: s.from[0] + ux * mid, y: y - hy, z: s.from[1] + uz * mid, hx, hy, hz: run / 2, yaw });
  }
  return out;
}
