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
import * as v from 'valibot';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { createWaterMaterial } from '@wildshard/engine/world/waterSurface';
import { BEAVER_POOL, beaverPoolLevel } from '../layout';
import { smoothstep } from '@wildshard/engine/core/noise';
import poolJson from '../data/beaverPool.json' with { type: 'json' };

/** seconds from the sluice lifting to the muddy bed */
export const DRAIN_S = 8;
/** the wet film's depth code on the uncovered bed (waterSurface.ts: the wet line peaks between −0.12 and −0.4) */
const MUD_FILM = -0.34;

const num = v.pipe(v.number(), v.finite());
const Mesh = { position: v.array(num), uv: v.array(num), aWater: v.array(num), index: v.array(v.pipe(v.number(), v.integer(), v.minValue(0))) };
/** the two meshes' blocks (f32-exact; the still surface with the ground under each vertex), baked offline (G285:
 *  ../generators/beaverPool.ts over the page's own terrain, `src/shards/pine-hollow/generators/bake-pine-beaver-pool.mjs`) */
export const PoolRowsSchema = v.strictObject({ still: v.strictObject({ ...Mesh, ground: v.array(num) }), trickle: v.strictObject(Mesh) });
export type PoolRows = v.InferOutput<typeof PoolRowsSchema>;
/** the bake's rows, parsed strictly once */
export const POOL_ROWS: PoolRows = v.parse(PoolRowsSchema, poolJson);

/** a water mesh's geometry from its blocks, normals from its triangles (as the builder's) */
function poolGeometry(m: PoolRows['trickle']): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(m.position, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(m.uv, 2));
  geo.setAttribute('aWater', new THREE.Float32BufferAttribute(m.aWater, 4));
  geo.setIndex(m.index);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
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

  /** the pool's still surface on the pond surface's grid (baked: the cells in the pool's reach, not always above its water) */
  private buildStill(): THREE.Mesh {
    this.ground = new Float32Array(POOL_ROWS.still.ground);
    const geo = poolGeometry(POOL_ROWS.still);
    const { material } = createWaterMaterial(this.sky, { skyline: null, forestSinEl: 0.3 });
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = 'beaver-pool';
    mesh.receiveShadow = true;
    mesh.renderOrder = 5;                                                   // with the pond
    return mesh;
  }

  /** the trickle: the channel's line from the riffle's crest to under the dam, a few cm over the bed (baked) */
  private buildTrickle(): THREE.Mesh {
    const geo = poolGeometry(POOL_ROWS.trickle);
    const { material } = createWaterMaterial(this.sky, { skyline: null, forestSinEl: 0.3, fade: this.trickleFade });
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = 'beaver-pool-trickle';
    mesh.receiveShadow = true;
    mesh.renderOrder = 6;
    return mesh;
  }
}
