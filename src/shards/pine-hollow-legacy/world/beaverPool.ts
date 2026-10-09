/**
 * Pine Hollow's beaver pool (E322 F-L6, Jake's pick "Local pool"): the dam's own small pool on the creek between the
 * gravel riffle at the pond's outlet and the dam (its bowl: BEAVER_POOL in src/shards/pine-hollow/layout.ts, carved by the
 * chunk's landscape). Full, it stands at the pond's level; when the sluice opens (`open:dam-sluice`) it drains over
 * DRAIN_S to a muddy bed and the pond's outflow runs on as a trickle down the bed and out through the sluice.
 *
 *   const pool = new BeaverPool(sky).build(); scene.add(pool.group);
 *   pool.setOpen(flags.has('open:dam-sluice'), true);    // a reload with the sluice open starts drained
 *   flags.onChange((f, on) => { if (f === 'open:dam-sluice') pool.setOpen(on); });
 *   game.onUpdate((dt) => { pool.update(dt); });
 *
 * Two draws in the creek's water (waterSurface.ts, as PineStreams draws it):
 *   · `still`: the pool's surface, laid on the pond surface's own grid (Water.ts `pondGrid`) over exactly the cells the
 *     pond leaves out (`ShardManifest.pondClip`), so full, the two read as one sheet over the riffle. While it drains each
 *     vertex is re-laid at the new level; the bed it uncovers keeps a glossy wet film (the shader's wet line), the mud.
 *   · `trickle`: a narrow running ribbon down the bed's channel, riffle to sluice, fading in as the pool goes.
 * The level also drives the creek's `streamAt` (`beaverPoolLevel`), so wading and the animals' dry test follow it; the
 * bed is the terrain itself, so the drained pool is walked on like any ground (the heightfield collider).
 */
import * as THREE from 'three';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { createWaterMaterial } from '@wildshard/engine/world/waterSurface';
import { pondGrid } from './pond';
import {
  BEAVER_POOL, CREEK, CREEK_WATER, beaverPoolLevel, creekBedAt, creekSpan, inBeaverPool, type XZ,
} from '../layout';
import { smoothstep } from '@wildshard/engine/core/noise';

/** seconds from the sluice lifting to the muddy bed */
export const DRAIN_S = 8;
/** the wet film's depth code on the uncovered bed (waterSurface.ts: the wet line peaks between −0.12 and −0.4) */
const MUD_FILM = -0.34;
/** the trickle's across-channel offsets (m) and its depth code there (0 at the edges: they fade into the mud) */
const TRICKLE_ACROSS = [-0.9, -0.45, 0, 0.45, 0.9];
const TRICKLE_DEPTH = [0, 0.07, 0.11, 0.07, 0];


/** the creek's polyline point and unit direction at arc length `s` */
function creekAt(s: number): { x: number; z: number; tx: number; tz: number } {
  let acc = 0;
  for (let i = 0; i + 1 < CREEK.length; i++) {
    const a: XZ | undefined = CREEK[i], b: XZ | undefined = CREEK[i + 1];
    if (!a || !b) continue;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (s <= acc + l || i + 2 === CREEK.length) {
      const u = l > 0 ? (s - acc) / l : 0;
      return { x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u, tx: (b[0] - a[0]) / (l || 1), tz: (b[1] - a[1]) / (l || 1) };
    }
    acc += l;
  }
  return { x: 0, z: 0, tx: 0, tz: 1 };
}

export class BeaverPool {
  readonly group = new THREE.Group();
  /** the pool's still surface */
  still!: THREE.Mesh;
  /** the trickle down the drained bed */
  trickle!: THREE.Mesh;
  /** 0 full … 1 drained */
  private t = 0;
  private open = false;
  private ground = new Float32Array(0);
  private readonly trickleFade = { value: 0 };

  constructor(private sky: Sky) {}

  build(): this {
    this.still = this.buildStill();
    this.trickle = this.buildTrickle();
    this.group.add(this.still, this.trickle);
    this.group.name = 'beaver-pool';
    this.apply();
    return this;
  }

  /** the sluice is open (the pool drains, over DRAIN_S unless `instant`) or shut (it stands full) */
  setOpen(open: boolean, instant = false): void {
    this.open = open;
    if (instant) { this.t = open ? 1 : 0; this.apply(); }
  }

  /** the pool's level now (m) */
  get level(): number { return beaverPoolLevel.y; }

  update(dt: number): void {
    const goal = this.open ? 1 : 0;
    if (this.t === goal) return;
    this.t = goal > this.t ? Math.min(1, this.t + dt / DRAIN_S) : Math.max(0, this.t - dt / DRAIN_S);
    this.apply();
  }

  /** lay the surface at the level `t` gives: fast at first, slowing as the head falls (an orifice drains as √head) */
  private apply(): void {
    const P = BEAVER_POOL, e = 1 - (1 - this.t) ** 2;
    const level = P.full + (P.drained - P.full) * e;
    beaverPoolLevel.y = level;
    const geo = this.still.geometry;
    const pos = geo.getAttribute('position'), aw = geo.getAttribute('aWater');
    for (let k = 0; k < pos.count; k++) {
      const h = this.ground[k] ?? 0, d = level - h;
      let y = level, code = d;
      if (d < 0) {
        if (h < P.full) { y = h + 0.05; code = Math.max(d, MUD_FILM); }   // the bed the water left: wet mud
        else if (d > -0.45) y = h + 0.05;                                   // the bank just over the full line: the wet line
      }
      pos.setY(k, y); aw.setX(k, code);
    }
    pos.needsUpdate = true; aw.needsUpdate = true;
    this.trickleFade.value = smoothstep(0.45, 0.9, this.t);
    this.trickle.visible = this.trickleFade.value > 0.001;
  }

  /** the pool's cells on the pond surface's grid: those whose centre is in the pool's reach and not always above the water */
  private buildStill(): THREE.Mesh {
    const { cell, x0, z0 } = pondGrid(), P = BEAVER_POOL, { dam } = creekSpan();
    // the reach's bounding box, from the creek's line ± 12 m
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let s = P.riffle; s <= dam; s += 1) {
      const c = creekAt(s);
      minX = Math.min(minX, c.x - 12); maxX = Math.max(maxX, c.x + 12); minZ = Math.min(minZ, c.z - 12); maxZ = Math.max(maxZ, c.z + 12);
    }
    const i0 = Math.floor((minX - x0) / cell), i1 = Math.ceil((maxX - x0) / cell);
    const j0 = Math.floor((minZ - z0) / cell), j1 = Math.ceil((maxZ - z0) / cell);
    const cols = i1 - i0 + 1;
    const vid = new Map<number, number>(), pos: number[] = [], uv: number[] = [], aw: number[] = [], ground: number[] = [], idx: number[] = [];
    const vert = (i: number, j: number): number => {
      const key = (j - j0) * cols + (i - i0);
      const had = vid.get(key);
      if (had !== undefined) return had;
      const x = x0 + i * cell, z = z0 + j * cell, h = heightAt(x, z), k = ground.length;
      pos.push(x, P.full, z); uv.push(x, z); aw.push(P.full - h, 0, 0, 2.4);   // still, peaty like the pond: 2.4 / m
      ground.push(h);
      vid.set(key, k);
      return k;
    };
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
      if (!inBeaverPool(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell)) continue;
      const hs = [heightAt(x0 + i * cell, z0 + j * cell), heightAt(x0 + (i + 1) * cell, z0 + j * cell), heightAt(x0 + i * cell, z0 + (j + 1) * cell), heightAt(x0 + (i + 1) * cell, z0 + (j + 1) * cell)];
      if (hs.every((h) => h > P.full + 0.45)) continue;                    // under the bank at every level: never seen
      const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1);
      idx.push(a, c, b, b, c, d);                                           // wound as the pond's
    }
    this.ground = new Float32Array(ground);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('aWater', new THREE.Float32BufferAttribute(aw, 4));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const { material } = createWaterMaterial(this.sky, { skyline: null, forestSinEl: 0.3 });
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = 'beaver-pool';
    mesh.receiveShadow = true;
    mesh.renderOrder = 5;                                                   // with the pond
    return mesh;
  }

  /** the trickle: the channel's line from the riffle's crest to under the dam, a few cm over the bed, tumbling off the riffle */
  private buildTrickle(): THREE.Mesh {
    const P = BEAVER_POOL, { dam } = creekSpan(), end = dam - CREEK_WATER.lead + 0.4, speed = 0.45;
    const pos: number[] = [], uv: number[] = [], aw: number[] = [], idx: number[] = [];
    let rows = 0;
    for (let s = P.riffle - 0.6; s <= end + 1e-6; s += 0.5) {
      const c = creekAt(s), lx = -c.tz, lz = c.tx;
      const foam = 0.12 + 0.4 * (1 - smoothstep(P.riffle, P.riffle + 2.5, s)) * smoothstep(P.riffle - 0.6, P.riffle, s);
      TRICKLE_ACROSS.forEach((o, k) => {
        const x = c.x + lx * o, z = c.z + lz * o, h = heightAt(x, z);
        pos.push(x, Math.max(h + 0.04, creekBedAt(s) + 0.04), z);
        uv.push(o, s / speed);                                              // travel time: the ripples ride the flow
        aw.push(TRICKLE_DEPTH[k] ?? 0, 1, foam, 2.0);                       // running, tea-brown like the creek
      });
      rows++;
    }
    const cols = TRICKLE_ACROSS.length;
    for (let r = 0; r + 1 < rows; r++) for (let c = 0; c + 1 < cols; c++) {
      const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      idx.push(a, b, d, b, e, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('aWater', new THREE.Float32BufferAttribute(aw, 4));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const { material } = createWaterMaterial(this.sky, { skyline: null, forestSinEl: 0.3, fade: this.trickleFade });
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = 'beaver-pool-trickle';
    mesh.receiveShadow = true;
    mesh.renderOrder = 6;
    return mesh;
  }
}
