/**
 * Seabed — the lagoon floor of an open-water shard (Driftwood Isle): where its reef stands and its fish swim (E306 /
 * E315 M1: the coral clumps, seaweed beds, reef starfish and the fish are models, src/shards/driftwood-isle/models/
 * reef.ts and reefFish.ts; this is the world side). The reef is ONE flat-shaded vertex-coloured mesh (one draw call,
 * ~15k tris at the default count): the lagoon builds every copy from its model in scatter order, from one rng stream (the
 * old loop's), welds them and places each kind `drawnInto` that mesh (its copies and card). The seaweed sways in the
 * vertex shader; nothing collides (you swim through it — underwater is decorative, no underworld).
 *
 *   const seabed = new Seabed(sky).build(Seabed.scatterLagoon(seed));   // where the water is 1.5–8 m deep
 *   scene.add(seabed.mesh);
 *   game.onUpdate((dt) => seabed.update(dt));                           // the sway clock, the school
 *
 * `seabed.fish`: the school — the reef fish placed instanced (one more draw call), circling a lissajous path over the
 * reef; built when the layout has a `school` (scatterLagoon adds one).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CHUNK_HALF, ROAD_WIDTH } from '@wildshard/engine/core/config';
import { Noise2D } from '@wildshard/engine/core/noise';
import { Rng } from '@wildshard/engine/core/rng';
import { modelContext, type ModelPart, type Placement } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import { normalAt, inChunk } from '@wildshard/engine/world/Heightfield';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { OCEAN } from '../manifest';
import { REEF, reefMaterial, type ReefParams } from '../models/reef';
import { REEF_FISH_COLOURS, reefFish } from '../models/reefFish';

export type SeabedKind = 'coral' | 'weed' | 'star';
export interface SeabedSpec { kind: SeabedKind; x: number; z: number; s: number; rot: number; v: number }
export interface SeabedLayout { items: SeabedSpec[]; school?: { x: number; z: number; y: number; r: number; n: number } | undefined }

const isParts = (b: readonly ModelPart[] | THREE.Object3D): b is readonly ModelPart[] => Array.isArray(b);
const isInstanced = (o: THREE.Object3D): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh;

export class Seabed {
  /** its placements (the named places' sets read them, src/shards/driftwood-isle/world/places.ts) */
  readonly placed: Placed[] = [];
  mesh!: THREE.Mesh;
  fish?: THREE.InstancedMesh;
  count = 0; tris = 0;
  /** the reef's sway clock (its material's) */
  private uniforms: { uTime: THREE.IUniform<number> } | null = null;
  private school?: { x: number; z: number; y: number; r: number; n: number; seeds: Float32Array };
  private tmp = { m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(), s: new THREE.Vector3(), f: new THREE.Vector3() };

  constructor(private sky: Sky) {}

  /** Lagoon rule: sand shelf 1.5–8 m under the surface, on gentle slopes, off the four entry sandbars (the jetties); corals in
   *  noise-clustered reefs, seaweed in beds, a starfish here and there. `avoid` clears the wreck / anything else on the sand. */
  static scatterLagoon(seed: number, count = 360, avoid: { x: number; z: number; r: number }[] = []): SeabedLayout {
    const rng = new Rng(seed ^ 0x5eab), reef = new Noise2D(seed + 51), bed = new Noise2D(seed + 52);
    const level = OCEAN.level;
    const items: SeabedSpec[] = [];
    let tries = 0;
    const ok = (x: number, z: number, minD: number) => {
      if (!inChunk(x, z, 14)) return false;
      if (Math.abs(x) < ROAD_WIDTH / 2 + 5 && Math.abs(z) > CHUNK_HALF - 75) return false; // the S / N jetties' sandbars
      if (Math.abs(z) < ROAD_WIDTH / 2 + 5 && Math.abs(x) > CHUNK_HALF - 120) return false; // the W / E ones (the E jetty runs on into the cove)
      if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) < a.r)) return false;
      return !items.some((p) => Math.hypot(p.x - x, p.z - z) < minD);
    };
    while (items.length < count && tries++ < count * 60) {
      const x = rng.range(-CHUNK_HALF + 14, CHUNK_HALF - 14), z = rng.range(-CHUNK_HALF + 14, CHUNK_HALF - 14);
      const d = level - heightAt(x, z);
      if (d < 1.5 || d > 8) continue;
      const [, ny] = normalAt(x, z, 1.5);
      if (ny < 0.86) continue;
      const r = reef.fbm(x * 0.02, z * 0.02, 2), b = bed.fbm(x * 0.03 + 7, z * 0.03, 2);
      const roll = rng.next();
      if (r > 0.12 && roll < 0.75) {
        // a reef: corals, denser toward the reef's heart
        if (rng.next() > (r - 0.12) * 2.2 + 0.25) continue;
        if (!ok(x, z, 1.6)) continue;
        items.push({ kind: 'coral', x, z, s: rng.range(0.6, 1.5) * (1 + Math.max(0, r) * 0.6), rot: rng.range(0, Math.PI * 2), v: rng.next() });
      } else if (b > 0.05 && roll < 0.92) {
        if (rng.next() > (b - 0.05) * 2.6 + 0.2) continue;
        if (!ok(x, z, 1.2)) continue;
        items.push({ kind: 'weed', x, z, s: rng.range(0.7, 1.4) * (0.7 + Math.min(1, d / 4) * 0.5), rot: rng.range(0, Math.PI * 2), v: rng.next() });
      } else if (roll >= 0.92 && rng.next() < 0.5) {
        if (!ok(x, z, 2.5)) continue;
        items.push({ kind: 'star', x, z, s: rng.range(0.5, 0.9), rot: rng.range(0, Math.PI * 2), v: rng.next() });
      }
    }
    // the fish school: over the densest reef patch we placed, at mid-depth
    let best: SeabedSpec | undefined, bestN = -1;
    for (const p of items) {
      if (p.kind !== 'coral') continue;
      let n = 0; for (const q of items) if (q.kind === 'coral' && Math.hypot(q.x - p.x, q.z - p.z) < 12) n++;
      if (n > bestN) { bestN = n; best = p; }
    }
    const school = best ? { x: best.x, z: best.z, y: level - Math.min(3, (level - heightAt(best.x, best.z)) * 0.55), r: 7, n: 28 } : undefined;
    return { items, school };
  }

  build(layout: SeabedLayout | SeabedSpec[]): this {
    const specs = Array.isArray(layout) ? layout : layout.items;
    const ctx = modelContext(this.sky);
    // one stream through every copy, in scatter order, across the kinds (the old loop's)
    const rng = new Rng(0x5ea1 ^ 0xc0);
    const parts: THREE.BufferGeometry[] = [];
    const kinds = new Map<SeabedKind, { pls: Placement<ReefParams>[]; boxes: number[] }>();
    const box = new THREE.Box3();
    for (const p of specs) {
      const y = heightAt(p.x, p.z), params: ReefParams = { s: p.s, rot: p.rot, v: p.v };
      const built = REEF[p.kind].build(ctx, params, rng), part = isParts(built) ? built[0] : undefined;
      if (!part) continue;
      const g = part.geometry.translate(p.x, y, p.z);
      parts.push(g);
      g.computeBoundingBox();
      box.copy(g.boundingBox ?? box);
      let k = kinds.get(p.kind);
      if (!k) { k = { pls: [], boxes: [] }; kinds.set(p.kind, k); }
      k.pls.push({ x: p.x, y, z: p.z, params });
      k.boxes.push(box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z);
      this.count++;
    }
    const geo = mergeGeometries(parts, false);
    geo.computeBoundingSphere();
    this.tris = geo.getAttribute('position').count / 3;
    const { material, uniforms } = reefMaterial(ctx);
    this.uniforms = uniforms;
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.castShadow = false; this.mesh.receiveShadow = true;
    this.mesh.name = 'seabed';
    for (const [kind, k] of kinds) this.placed.push(place(REEF[kind], k.pls, { ctx, draw: 'merged', drawnInto: { object: this.mesh, boxes: Float32Array.from(k.boxes) }, piece: { id: `seabed-${kind}` } }));
    if (!Array.isArray(layout) && layout.school) this.buildSchool(ctx, layout.school);
    return this;
  }

  /** the school: the reef fish placed instanced (their colours per copy), swum round a lissajous loop over the reef */
  private buildSchool(ctx: ReturnType<typeof modelContext>, s: { x: number; z: number; y: number; r: number; n: number }): void {
    const rng = new Rng(0xf15c);
    const n = s.n, seeds = new Float32Array(n * 3), pls: Placement<Record<string, never>>[] = [];
    for (let i = 0; i < n; i++) {
      const cc = REEF_FISH_COLOURS[Math.floor(rng.next() * REEF_FISH_COLOURS.length)];
      if (cc === undefined) throw new Error('[seabed] fish tint index out of range');
      pls.push({ x: s.x, y: s.y, z: s.z, color: cc });
      seeds[i * 3] = rng.range(0, Math.PI * 2); seeds[i * 3 + 1] = rng.range(0.6, 1); seeds[i * 3 + 2] = rng.range(-1, 1);
    }
    const placed = place(reefFish, pls, { ctx, draw: 'instanced', piece: { id: 'reef-fish' } });
    this.placed.push(placed);
    const mesh = placed.object;
    if (!isInstanced(mesh)) return;
    // they swim: posed every frame (update), never culled as a set
    mesh.frustumCulled = false;
    mesh.name = 'seabed-fish';
    this.fish = mesh;
    this.school = { ...s, seeds };
    this.update(0);
  }

  update(dt: number): void {
    const clock = this.uniforms;
    if (clock) clock.uTime.value += dt;
    const s = this.school, mesh = this.fish;
    if (!s || !mesh) return;
    const t = (clock?.uTime.value ?? 0) * 0.35, { m, p, q, e, s: sc, f } = this.tmp;
    for (let i = 0; i < s.n; i++) {
      const ph = s.seeds[i * 3] ?? 0, spd = s.seeds[i * 3 + 1] ?? 0, off = s.seeds[i * 3 + 2] ?? 0;
      const u = t * spd + ph;
      // lissajous loop around the school centre, each fish on its own offset ring; a little bob
      const x = s.x + Math.sin(u) * s.r * (1 + off * 0.25) + Math.cos(u * 2.3 + ph) * 0.6;
      const z = s.z + Math.sin(u * 0.5 + 1.2) * s.r * 0.8 + Math.sin(u * 1.7 + ph) * 0.5;
      const y = s.y + Math.sin(u * 1.3 + ph) * 0.5 + off * 0.4;
      // heading = the path tangent (finite difference)
      const du = 0.05;
      f.set(Math.sin(u + du) * s.r * (1 + off * 0.25) + Math.cos((u + du) * 2.3 + ph) * 0.6 - (x - s.x), Math.sin((u + du) * 1.3 + ph) * 0.5 + off * 0.4 - (y - s.y), Math.sin((u + du) * 0.5 + 1.2) * s.r * 0.8 + Math.sin((u + du) * 1.7 + ph) * 0.5 - (z - s.z));
      const yaw = Math.atan2(-f.x, -f.z), pitch = Math.atan2(f.y, Math.hypot(f.x, f.z));
      e.set(pitch, yaw, Math.sin(u * 9 + ph) * 0.15, 'YXZ');
      q.setFromEuler(e); p.set(x, y, z); sc.setScalar(0.8 + spd * 0.5);
      mesh.setMatrixAt(i, m.compose(p, q, sc));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}
