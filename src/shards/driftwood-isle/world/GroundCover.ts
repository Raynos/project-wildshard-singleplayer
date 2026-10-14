import { DENSITY, beach, ss, type Site } from '../runtime/looks/coverSites';
/**
 * GroundCover — Driftwood Isle's ground cover near the player (remaster M4): instanced low-poly grass tufts, ferns,
 * hibiscus, white daisies and mossy pebbles on the grass, sparse sun-bleached beach grass on the sand, and a thicker
 * fern understorey in the shrine jungle. So the island interior stops reading as empty planes.
 *
 * Drawn by @wildshard/sdk/looks/streamedCover from the rows in data/groundCoverLook.ts: one InstancedMesh per plant (two,
 * E186: written and uploaded behind, swapped in one frame), refilled from 16 m cells round the viewer every 4 m, each
 * plant at its own edge in its kind's reach (E117: no ring, no pop), a far tier of stand-ins past the near set (E117
 * follow-up: "more distant cover"), plants on sloping ground keeping their reach further (E156 C), and the plants fading
 * into the colour the ground wears (E156: coverTint.ts's grid, compiled from the same rules). This file
 * is where a plant may stand and how dense each kind is there: its sites, densities and tints are the system's hooks.
 *
 *   const cover = new GroundCover(sky, { sea: sea.level, grid: admitted }).build();
 *   scene.add(cover.group);
 *   game.onUpdate((dt) => cover.update(dt, player.position));
 *
 * Placement follows the terrain's own paint (look/groundColor.ts lowPolyGroundColor): grass above ~3 m over the sea on slopes
 * under 0.24, sand below; never on the sand paths, on steep rock, in the water, or inside a POI's footprint. No URL
 * switches (Jake, 2026-09-25); every decided Debug row is gone (E318).
 */
import * as THREE from 'three';
import { duneLogs } from '../models/duneLogs';
import { HUT, LOOKOUT, SHRINE, WRECK } from '../manifest';
import { Cove } from './Cove';
import { copyCoverGeometry } from '../boot/coverGeometry';
import { GROUND_COVER } from '../runtime/looks/groundCoverLook';
import { lowPolyGroundColor } from '../look/groundColor';
import { CoverGrid, COVER_SEEN_GLSL, coverSample, coverJitter } from './coverTint';
import { driftLog, driftLogBox } from '../models/driftLog';
import { SEED } from '@wildshard/engine/core/config';
import type { Rng } from '@wildshard/engine/core/rng';
import { modelContext } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { BlenderArea } from '@wildshard/engine/world/blenderArea';
import { normalAt, trailDistance } from '@wildshard/engine/world/Heightfield';
import { lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { StreamedCover, type StreamedCoverHooks, type StreamedCover as StreamedCoverSet, type StreamedCoverStats } from '../runtime/looks/streamedCover';

export interface GroundCoverOpts {
  sea: number;
  /** Borrowed validated full-grid file, including the authored Blender overlay. */
  grid: Parameters<typeof CoverGrid.create>;
  /** the palms (Palms.scatterIsland): ferns, hibiscus and bushes crowd round their feet */
  palms?: { x: number; z: number }[];
}

/** a candidate point: its height over the sea, slope and normal, its trail and shrine distances and how near a palm it is */
type Tint = (h: number, rng: Rng, out: THREE.Color) => void;

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
      ground: (x, z, s, out, o) => this.ground(x, z, s, out, o),
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

  /** a plant's ground: the cover grid's look (E156: side, then rgb and top after) and the terrain's facet colour there,
   *  at out[o …]; returns its height */
  private ground(x: number, z: number, s: Site, out: Float32Array, o: number): number {
    const y = heightAt(x, z), c = this.groundColor, cv = this.coverAt, grid = CoverGrid.get();
    lowPolyGroundColor(c, y - this.opts.sea, s.slope, x, z);
    if (grid) grid.sample(x, z, cv); else { cv.r = 0; cv.g = 0; cv.b = 0; cv.top = 0; cv.side = 0; }
    const j = coverJitter(x, z);
    out[o] = cv.side; out[o + 1] = c.r; out[o + 2] = c.g; out[o + 3] = c.b;
    out[o + 4] = cv.r * j; out[o + 5] = cv.g * j; out[o + 6] = cv.b * j; out[o + 7] = cv.top;
    return y;
  }

  build(): this {
    this.cover.build();
    CoverGrid.create(...this.opts.grid);
    this.buildDriftwood();
    this.group.name = 'ground-cover';
    return this;
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
    const {geometry:geo,logs}=duneLogs(heightAt,trailDistance,this.avoid,this.opts.sea,SEED);
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
