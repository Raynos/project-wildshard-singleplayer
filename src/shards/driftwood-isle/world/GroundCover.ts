/**
 * GroundCover — Driftwood Isle's ground cover near the player (remaster M4): instanced low-poly grass tufts, ferns,
 * hibiscus, white daisies and mossy pebbles on the grass, sparse sun-bleached beach grass on the sand, and a thicker
 * fern understorey in the shrine jungle. So the island interior stops reading as empty planes.
 *
 * Drawn by @wildshard/sdk/looks/streamedCover from the rows in data/groundCoverLook.ts: one InstancedMesh per plant (two,
 * E186: written and uploaded behind, swapped in one frame), refilled from 16 m cells round the viewer every 4 m, each
 * plant at its own edge in its kind's reach (E117: no ring, no pop), a far tier of stand-ins past the near set (E117
 * follow-up: "more distant cover"), plants on sloping ground keeping their reach further (E156 C), and the plants fading
 * into the colour the ground wears (E156: coverTint.ts's grid, which `fillCoverGrid` writes from the same rules). This file
 * is where a plant may stand and how dense each kind is there: its sites, densities and tints are the system's hooks.
 *
 *   const cover = new GroundCover(sky, { sea: sea.level }).build();
 *   scene.add(cover.group);
 *   game.onUpdate((dt) => cover.update(dt, player.position));
 *
 * Placement follows the terrain's own paint (look/groundColor.ts lowPolyGroundColor): grass above ~3 m over the sea on slopes
 * under 0.24, sand below; never on the sand paths, on steep rock, in the water, or inside a POI's footprint. No URL
 * switches (Jake, 2026-09-25); every decided Debug row is gone (E318).
 */
import * as THREE from 'three';
import { addDriftLog, DRIFT } from './driftLogs';
import { HUT, LOOKOUT, SHRINE, WRECK, ISLAND } from '../manifest';
import { Cove } from './Cove';
import { copyCoverGeometry } from '../boot/coverGeometry';
import COVER_LOOK from '../data/coverLook.json' with { type: 'json' };
import { GROUND_COVER } from '../data/groundCoverLook';
import { lowPolyGroundColor } from '../look/groundColor';
import { CoverGrid, COVER_SEEN_GLSL, coverSample, coverJitter } from './coverTint';
import { driftLog, driftLogBox } from '../models/driftLog';
import { diagnosticNow } from '@wildshard/engine/core/clock';
import { SEED } from '@wildshard/engine/core/config';
import type { Rng } from '@wildshard/engine/core/rng';
import { modelContext } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { BlenderArea } from '@wildshard/engine/world/blenderArea';
import { log } from '@wildshard/engine/world/geometryKit';
import { normalAt, trailDistance } from '@wildshard/engine/world/Heightfield';
import { LowPolyKit, lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { StreamedCover, type CoverGround, type CoverSite, type StreamedCoverHooks, type StreamedCoverSet, type StreamedCoverStats } from '@wildshard/sdk/looks/streamedCover';

export interface GroundCoverOpts {
  sea: number;
  /** the palms (Palms.scatterIsland): ferns, hibiscus and bushes crowd round their feet */
  palms?: { x: number; z: number }[];
}

/** a candidate point: its height over the sea, slope and normal, its trail and shrine distances and how near a palm it is */
interface Site extends CoverSite { td: number; sd: number; palm: number }
type Density = (s: Site) => number;
type Tint = (h: number, rng: Rng, out: THREE.Color) => void;

const ss = (e0: number, e1: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const beach = (h: number) => ss(0.5, 1.2, h) * (1 - ss(2.0, 3.2, h));
const grass = (h: number, slope: number) => ss(2.6, 4.2, h) * (1 - ss(0.18, 0.26, slope));
const off = (td: number) => ss(2.6, 4.0, td);
const jungle = (sd: number) => 1 - ss(18, 45, sd);
/** the sand -> grass edge (the plant fringe) and the dune crest (beach grass) */
const edge = (h: number, sl: number): number => ss(1.9, 2.7, h) * (1 - ss(4.8, 7, h)) * (1 - ss(0.2, 0.3, sl));
const dune = (h: number): number => ss(1.2, 1.8, h) * (1 - ss(2.6, 3.4, h));

/** each kind's instances per candidate × 2 at a site (by the rows' names) */
const DENSITY: Readonly<Record<string, Density>> = {
  tuft: (s) => (grass(s.h, s.slope) * 1.6 + beach(s.h) * 0.18 + dune(s.h) * 0.7) * off(s.td),
  fern: (s) => (grass(s.h, s.slope) * (0.03 + jungle(s.sd) * 0.35) + edge(s.h, s.slope) * 0.45 + s.palm * 0.45) * off(s.td),
  hibiscus: (s) => (grass(s.h, s.slope) * (0.025 + jungle(s.sd) * 0.08) + edge(s.h, s.slope) * 0.3 + s.palm * 0.28) * off(s.td),
  daisy: (s) => (grass(s.h, s.slope) * 0.07 + edge(s.h, s.slope) * 0.3) * off(s.td),
  pebble: (s) => (grass(s.h, s.slope) * 0.03 + beach(s.h) * 0.05) * (0.4 + 0.6 * off(s.td)),
  // (E43) the beach: a shell / starfish / pebble scatter every 1-2 m on the sand, beach grass on the dune crest, and a
  // dense fringe of ferns, hibiscus, flowers and bushes along the sand -> grass edge and round every palm's foot
  shells: (s) => beach(s.h) * 0.8,
  starfish: (s) => beach(s.h) * 0.09,
  bush: (s) => (edge(s.h, s.slope) * 0.3 + s.palm * 0.3 + grass(s.h, s.slope) * 0.015) * off(s.td) + jungle(s.sd) * grass(s.h, s.slope) * 0.06,
};
/** the tinted kinds' per-instance tint (multiplies the vertex colours) */
const TINT: Readonly<Record<string, Tint>> = {
  tuft: (h, r, out) => { const b = beach(h); out.setRGB(1 + b * 0.35 + r.range(-0.08, 0.08), 1 + b * 0.12 + r.range(-0.06, 0.06), 1 - b * 0.35); },
  shells: (_h, r, out) => { const v = r.next(); out.setRGB(v < 0.3 ? 1.0 : 1.05, v < 0.3 ? 0.85 : 1.0, 0.95); },
  starfish: (_h, r, out) => { const v = r.next(); if (v < 0.25) out.setRGB(0.55, 0.45, 1.3); else if (v < 0.5) out.setRGB(1.05, 0.95, 0.6); else out.setRGB(1, 1, 1); },
};
const KIND_DENSITY = GROUND_COVER.kinds.map((k) => DENSITY[k.name] ?? (() => 0));
const KIND_TINT = GROUND_COVER.kinds.map((k) => TINT[k.name] ?? null);

export class GroundCover {
  /** its placements: the dune line's drift logs (the named places' sets read them) */
  readonly placed: Placed[] = [];
  private readonly cover: StreamedCoverSet<Site>;
  /** E156: the Blender island's area once it has loaded — its own cover dresses it, so no plant of ours is placed there */
  private skip: BlenderArea | null = null;
  private readonly avoid: { x: number; z: number; r: number }[] = [];
  private readonly palmGrid = new Map<string, { x: number; z: number }[]>();
  private readonly groundColor = new THREE.Color();
  private readonly coverAt = coverSample();
  private readonly sky: Sky;
  private readonly opts: GroundCoverOpts;

  constructor(sky: Sky, opts: GroundCoverOpts) {
    this.sky = sky;
    this.opts = opts;
    const cave = Cove.forIsland().cave;
    this.avoid = [
      { x: HUT.x, z: HUT.z, r: 9 }, { x: LOOKOUT.x, z: LOOKOUT.z, r: 8 }, { x: SHRINE.x, z: SHRINE.z, r: 9.5 },
      { x: WRECK.x, z: WRECK.z, r: 13 }, { x: cave.x, z: cave.z + cave.depth / 2, r: 8 },
      { x: 0, z: -151, r: 3.2 },                                   // the pier's landing
    ];
    for (const p of opts.palms ?? []) {
      const k = `${Math.floor(p.x / 8)},${Math.floor(p.z / 8)}`;
      const list = this.palmGrid.get(k);
      if (list) list.push(p); else this.palmGrid.set(k, [p]);
    }
    const hooks: StreamedCoverHooks<Site> = {
      newSite: () => ({ h: 0, slope: 0, nx: 0, ny: 1, nz: 0, td: 0, sd: 0, palm: 0 }),
      site: (x, z, s) => this.site(x, z, s),
      density: (ki, s) => (KIND_DENSITY[ki] ?? (() => 0))(s),
      tinted: (ki) => (KIND_TINT[ki] ?? null) !== null,
      tint: (ki, s, rng, out) => { KIND_TINT[ki]?.(s.h, rng, out); },
      ground: (x, z, s, out) => this.ground(x, z, s, out),
    };
    this.cover = new StreamedCover({ sky, row: GROUND_COVER, geometry: copyCoverGeometry(), hooks, heightAt, seed: SEED, glsl: { coverSeen: COVER_SEEN_GLSL } });
  }

  /** the cover's meshes and the dune logs */
  get group(): THREE.Group { return this.cover.group; }
  /** measurements for scripts/popin-fly.mjs / stutter-run.mjs (also group.userData.stats) */
  get stats(): StreamedCoverStats { return this.cover.stats; }

  /** 1 at a palm's foot, fading out by 3.5 m */
  private nearPalm(x: number, z: number): number {
    let best = 0;
    const gx = Math.floor(x / 8), gz = Math.floor(z / 8);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (const p of this.palmGrid.get(`${gx + dx},${gz + dz}`) ?? []) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < 3.5) best = Math.max(best, 1 - ss(1.0, 3.5, d));
    }
    return best;
  }

  /** a candidate point: none in a POI's footprint, the Blender island's area, the water or on steep rock */
  private site(x: number, z: number, s: Site): boolean {
    if (this.avoid.some((a) => (x - a.x) ** 2 + (z - a.z) ** 2 < a.r * a.r)) return false;
    const sk = this.skip;
    if (sk && x > sk.x0 && x < sk.x1 && z > sk.z0 && z < sk.z1) return false;
    const h = heightAt(x, z) - this.opts.sea;
    if (h < 0.4) return false;
    const [nx, ny, nz] = normalAt(x, z, 0.6), slope = 1 - ny;
    if (slope > 0.3) return false;
    s.h = h; s.slope = slope; s.nx = nx; s.ny = ny; s.nz = nz;
    s.td = trailDistance(x, z); s.sd = Math.hypot(x - SHRINE.x, z - SHRINE.z); s.palm = this.nearPalm(x, z);
    return true;
  }

  /** a plant's ground: its height, the terrain's facet colour there and the cover grid's look (E156) */
  private ground(x: number, z: number, s: Site, out: CoverGround): void {
    const y = heightAt(x, z), c = this.groundColor, cv = this.coverAt, grid = CoverGrid.get();
    lowPolyGroundColor(c, y - this.opts.sea, s.slope, x, z);
    if (grid) grid.sample(x, z, cv); else { cv.r = 0; cv.g = 0; cv.b = 0; cv.top = 0; cv.side = 0; }
    const j = coverJitter(x, z);
    out.y = y; out.r = c.r; out.g = c.g; out.b = c.b;
    out.side = cv.side; out.cr = cv.r * j; out.cg = cv.g * j; out.cb = cv.b * j; out.top = cv.top;
  }

  build(): this {
    this.cover.build();
    this.fillCoverGrid();
    this.buildDriftwood();
    this.group.name = 'ground-cover';
    return this;
  }

  /**
   * E156: the chunk's cover grid from the same rules the cells place by — per 4 m, each kind's expected plants per m²
   * (≈ 2.03 candidates per m², each kept with p = density / 2) × the ground one covers × its colour.
   */
  private fillCoverGrid(): void {
    const sea = this.opts.sea, grid = CoverGrid.create(), per = GROUND_COVER.candidates / (GROUND_COVER.cell * GROUND_COVER.cell), col = new THREE.Color();
    const site: Site = { h: 0, slope: 0, nx: 0, ny: 1, nz: 0, td: 0, sd: 0, palm: 0 };
    const t0 = diagnosticNow();
    grid.fill((x, z, out) => {
      if (this.avoid.some((a) => (x - a.x) ** 2 + (z - a.z) ** 2 < a.r * a.r)) return;
      const h = heightAt(x, z) - sea;
      if (h < 0.4) return;
      const [, ny] = normalAt(x, z, 0.6), slope = 1 - ny;
      if (slope > 0.3) return;
      site.h = h; site.slope = slope; site.td = trailDistance(x, z); site.sd = Math.hypot(x - SHRINE.x, z - SHRINE.z); site.palm = this.nearPalm(x, z);
      let top = 0, side = 0;
      col.setRGB(0, 0, 0);
      for (const [ki, k] of GROUND_COVER.kinds.entries()) {
        const look = COVER_LOOK[k.name as keyof typeof COVER_LOOK];
        const n = per * Math.min(1, Math.max(0, (KIND_DENSITY[ki] ?? (() => 0))(site)) / 2), s = (k.scale[0] + k.scale[1]) / 2, ns = n * s * s;
        const t = ns * look.top, sd2 = ns * look.side, wt = t + sd2;
        top += t; side += sd2; col.r += look.r * wt; col.g += look.g * wt; col.b += look.b * wt;
      }
      const w = top + side;
      if (w > 0) { out.r = col.r / w; out.g = col.g / w; out.b = col.b / w; out.top = 1 - Math.exp(-top); out.side = 1 - Math.exp(-side); }
    }, ISLAND.x - ISLAND.r - 40, ISLAND.x + ISLAND.r + 40, ISLAND.z - ISLAND.r - 40, ISLAND.z + ISLAND.r + 40);
    this.stats.gridMs = diagnosticNow() - t0;
  }

  /** the viewer moved: refill, upload and swap the near and far sets */
  update(dt: number, viewer: THREE.Vector3): void {
    this.cover.update(dt, viewer);
  }

  /** E156: the Blender island loaded — it dresses its own area, so the cells stop placing plants there (they were clipped
   *  in its shader, but each still took an instance and its vertices) */
  excludeArea(a: BlenderArea): void {
    this.skip = a;
    this.cover.reset();
  }

  /** bleached driftwood logs (the E149 painter, driftwood.ts) along the dune line all round the island, one every ~9 m (one static mesh) */
  private buildDriftwood(): void {
    const kit = new LowPolyKit(SEED ^ 0x6c08), rng = kit.rng, sea = this.opts.sea;
    const logs: { a: THREE.Vector3; b: THREE.Vector3; r: number; tone: number }[] = [];
    for (let a = 0; a < Math.PI * 2; a += 9 / 200) {
      const dx = Math.cos(a), dz = Math.sin(a);
      // march outward from inland to the first sand below the dune crest (~1.6 m over the sea)
      let r = 120, found = false;
      for (; r < 250; r += 1) { const x = ISLAND.x + dx * r, z = ISLAND.z + dz * r; if (heightAt(x, z) - sea < 1.6) { found = true; break; } }
      if (!found || rng.next() < 0.2) continue;
      const x = ISLAND.x + dx * (r - rng.range(0, 3)), z = ISLAND.z + dz * (r - rng.range(0, 3));
      if (Math.abs(x) > 245 || Math.abs(z) > 245) continue;
      if (this.avoid.some((p) => (x - p.x) ** 2 + (z - p.z) ** 2 < (p.r + 3) ** 2) || trailDistance(x, z) < 3.5) continue;
      const n = rng.next() < 0.35 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const len = rng.range(2.2, 4.2), rad = rng.range(0.12, 0.24), yaw = a + Math.PI / 2 + rng.range(-0.6, 0.6) + k * 1.1;
        const hx = Math.cos(yaw) * len / 2, hz = Math.sin(yaw) * len / 2;
        const A = new THREE.Vector3(x - hx, heightAt(x - hx, z - hz) + rad * 0.7 + k * 0.2, z - hz), B = new THREE.Vector3(x + hx, heightAt(x + hx, z + hz) + rad * 0.7 + k * 0.2, z + hz);
        addDriftLog(kit, A, B, rad, rad * 0.7, { sides: 6, twist: rng.range(0, 1), tone: k + Math.floor(a * 10), wobble: 0.02 });
        logs.push({ a: A, b: B, r: rad, tone: k + Math.floor(a * 10) });
        if (rng.next() < 0.5) { const m = A.clone().lerp(B, rng.range(0.3, 0.7)); kit.add(log(m, m.clone().add(new THREE.Vector3(rng.range(-0.3, 0.3), rng.range(0.25, 0.5), rng.range(-0.3, 0.3))), rad * 0.4, rad * 0.25, 5), DRIFT.stub); }
      }
    }
    const geo = kit.finish({ ao: { ground: heightAt, cell: 0.35, strength: 0.5 } });
    const mesh = new THREE.Mesh(geo, lowPolyMaterial(this.sky));
    mesh.name = 'ground-cover-driftwood';
    mesh.userData['coverProp'] = true; // static logs, not instanced cover: the perf probe's cover rows leave it (E405)
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.group.add(mesh);
    // E315 M1: each is the drift log model (src/shards/driftwood-isle/models/driftLog.ts), placed drawnInto this mesh
    const boxes: number[] = [], box = new THREE.Box3();
    const pls = logs.map((l) => {
      driftLogBox(l.a, l.b, l.r, box);
      boxes.push(box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z);
      const d = l.b.clone().sub(l.a);
      return { x: (l.a.x + l.b.x) / 2, y: (l.a.y + l.b.y) / 2, z: (l.a.z + l.b.z) / 2, yaw: Math.atan2(-d.z, d.x), params: { len: d.length(), r0: l.r, r1: l.r * 0.7, tone: ((l.tone % 3) + 3) % 3 } };
    });
    if (pls.length > 0) this.placed.push(place(driftLog, pls, { ctx: modelContext(this.sky), draw: 'merged', drawnInto: { object: mesh, boxes: Float32Array.from(boxes) }, piece: { id: 'cover-drift-logs' } }));
  }
}
