import * as THREE from 'three';
import { CHUNK_SIZE, TERRAIN_RES } from '@wildshard/engine/core/config';
import type { Material as SurfaceMaterial } from '@wildshard/engine/physics/surface';
import type { TerrainCut } from '@wildshard/engine/physics/terrain';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';

/**
 * A cave cut into the terrain (SHARD-PLATFORM M3, the kit system): one interior baked by a shard's builder, described in
 * its own frame (lx across, lz in, y world height) by a meta file, and a look row for its shaft of light and its drips.
 * From those it answers the world's questions: the physics heightfield's cuts, the drawn terrain's hole, the terrain
 * patch over the cut as a trimesh (the ground above the mouth comes back), the reverb spots, the footprint (no rain
 * inside), the passage's floor; and it draws the shaft (the shard's program, additive) and the drips near the mouth,
 * fills the walls by day through the shard's fill uniform and hides the sun's depth-less disc under the roof. The
 * interior's geometry and its rock material are the shard's; nothing here knows a shard's cave.
 */

/** The baked interior's meta file: everything in the cave's frame (lx across, lz in, y world height). */
export interface CaveMeta {
  version: number;
  /** the render hole: drawn-terrain triangles whose box overlaps one of these (local, axis-aligned) are dropped */
  holes: { lx: number; lz: number; hw: number; hd: number; y0: number; y1: number }[];
  /** the physics heightfield is pushed below `below` inside these (local rects; grown a cell by cutTerrain) */
  cuts: { lx: number; lz: number; hw: number; hd: number; below: number }[];
  /** the cave reverb / bed: circles along the passage and the room */
  spots: { lx: number; lz: number; r: number }[];
  /** the footprint (rain never falls inside it) */
  inside: [number, number][];
  /** the crack's shaft of light: its top (at the crack) and its foot (on the floor), radii */
  shaft: { top: [number, number, number]; foot: [number, number, number]; r0: number; r1: number };
  /** drip points on the roof: lx, y, lz, and the floor's height under each */
  drips: [number, number, number, number][];
  /** the floor's height along the passage (lz → y), for the spawn / the test poses */
  floor: [number, number][];
}

/** The cave's frame in the world: its mouth at (x, z), local +Z turned by `yaw` into the rock. */
export interface CaveFrame { readonly x: number; readonly z: number; readonly yaw: number }

/** How a cave looks and behaves near its mouth (a shard's data row). */
export interface CaveLookRow {
  /** metres from the mouth within which the shaft and the drips draw and animate */
  readonly near: number;
  /** the eye is under the roof below the floor (at its depth, clamped to [lzMin, lzMax]) plus `height` */
  readonly under: { readonly height: number; readonly lzMin: number; readonly lzMax: number };
  /** the walls' fill uniform by day: base + gain × day */
  readonly fill: readonly [number, number];
  /** the surface the cave's colliders report */
  readonly surface: SurfaceMaterial;
  /** the shaft: its program, its cone's segments, its render order, and its intensity gain × day × min(1, sunBase + max(0, sun.y) × sunGain) + floor */
  readonly shaft: {
    readonly vertex: string; readonly fragment: string;
    readonly radialSegments: number; readonly heightSegments: number; readonly renderOrder: number;
    readonly gain: number; readonly sunBase: number; readonly sunGain: number; readonly floor: number;
  };
  /** the drips: points falling from the roof, each forming for a while then falling under `gravity`; drip i's period is
   *  period + (i mod kinds) × periodStep, its phase offset i × phaseStep; it hangs `hang` below its roof point */
  readonly drips: {
    readonly color: number; readonly size: number; readonly opacity: number;
    readonly period: number; readonly periodStep: number; readonly kinds: number; readonly phaseStep: number;
    readonly gravity: number; readonly hang: number; readonly minDrop: number;
  };
}

/** A cave cut into the terrain (see the module comment). */
export class CaveInterior {
  readonly meta: CaveMeta;
  /** the shaft and the drips (added by `buildFx`) */
  readonly fx: THREE.Object3D[] = [];
  private readonly frame: CaveFrame;
  private readonly look: CaveLookRow;
  private readonly fill: { value: number };
  private shaft: THREE.Mesh | null = null;
  private drips: THREE.Points | null = null;
  private dripState: Float32Array = new Float32Array(0);
  private near = false;
  private under = false;

  /** `fill`: the walls' material's fill uniform this cave drives by day */
  constructor(meta: CaveMeta, frame: CaveFrame, look: CaveLookRow, fill: { value: number }) {
    this.meta = meta;
    this.frame = frame;
    this.look = look;
    this.fill = fill;
  }

  /** world (x, z) → cave-local (lx, lz) */
  local(x: number, z: number): [number, number] {
    const f = this.frame, c = Math.cos(f.yaw), s = Math.sin(f.yaw), dx = x - f.x, dz = z - f.z;
    return [dx * c - dz * s, dx * s + dz * c];
  }

  /** cave-local (lx, lz) → world (x, z) */
  world(lx: number, lz: number): [number, number] {
    const f = this.frame, c = Math.cos(f.yaw), s = Math.sin(f.yaw);
    return [f.x + lx * c + lz * s, f.z - lx * s + lz * c];
  }

  /** the physics heightfield's cuts (world rects): the ground under the passage where the slope runs through it */
  terrainCuts(): TerrainCut[] {
    return this.meta.cuts.map((c) => { const [x, z] = this.world(c.lx, c.lz); return { x, z, hw: c.hw, hd: c.hd, yaw: this.frame.yaw, below: c.below }; });
  }

  /** the drawn terrain's hole: true for a triangle (world vertices) that reaches into the cave's passage */
  holeTest(): (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number) => boolean {
    const holes = this.meta.holes;
    return (ax, ay, az, bx, by, bz, cx, cy, cz) => {
      const [alx, alz] = this.local(ax, az), [blx, blz] = this.local(bx, bz), [clx, clz] = this.local(cx, cz);
      const x0 = Math.min(alx, blx, clx), x1 = Math.max(alx, blx, clx), z0 = Math.min(alz, blz, clz), z1 = Math.max(alz, blz, clz);
      const y0 = Math.min(ay, by, cy), y1 = Math.max(ay, by, cy);
      for (const h of holes) {
        if (x1 < h.lx - h.hw || x0 > h.lx + h.hw || z1 < h.lz - h.hd || z0 > h.lz + h.hd || y1 < h.y0 || y0 > h.y1) continue;
        return true;
      }
      return false;
    };
  }

  /** the reverb / bed spots, world */
  spots(): { x: number; z: number; r: number }[] {
    return this.meta.spots.map((s) => { const [x, z] = this.world(s.lx, s.lz); return { x, z, r: s.r }; });
  }

  /** inside the footprint (no rain falls there) */
  inside(x: number, z: number): boolean {
    const poly = this.meta.inside;
    if (poly.length < 3) return false;
    const [lx, lz] = this.local(x, z);
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if (!a || !b) continue;
      if ((a[1] > lz) !== (b[1] > lz) && lx < ((b[0] - a[0]) * (lz - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }

  /** the passage's floor height at depth `lz` */
  floorAt(lz: number): number | undefined {
    const f = this.meta.floor;
    if (f.length === 0) return undefined;
    for (let i = 0; i + 1 < f.length; i++) {
      const a = f[i], b = f[i + 1];
      if (a && b && lz >= a[0] && lz <= b[0]) return a[1] + (b[1] - a[1]) * ((lz - a[0]) / Math.max(1e-6, b[0] - a[0]));
    }
    return undefined;
  }

  /**
   * The terrain over the cut (its drawn triangles that are not in the hole) as a trimesh: the heightfield under the cut
   * was pushed below the cave's floor, so the ground up there (on the slope above the mouth) comes back as this.
   */
  roofPatch(): ColliderDesc[] {
    const cuts = this.terrainCuts();
    if (cuts.length === 0) return [];
    const res = TERRAIN_RES, d = CHUNK_SIZE / (res - 1), half = CHUNK_SIZE / 2;
    const hole = this.holeTest();
    const cells = new Set<number>();
    for (const c of cuts) {
      const cos = Math.cos(c.yaw), sin = Math.sin(c.yaw), r = Math.hypot(c.hw, c.hd) + 3 * d;
      const i0 = Math.max(0, Math.floor((c.x - r + half) / d)), i1 = Math.min(res - 2, Math.ceil((c.x + r + half) / d));
      const k0 = Math.max(0, Math.floor((c.z - r + half) / d)), k1 = Math.min(res - 2, Math.ceil((c.z + r + half) / d));
      for (let iz = k0; iz <= k1; iz++) for (let ix = i0; ix <= i1; ix++) {
        const dx = ix * d - half - c.x, dz = iz * d - half - c.z;
        const lx = dx * cos - dz * sin, lz = dx * sin + dz * cos;
        if (Math.abs(lx) > c.hw + 2.5 * d || Math.abs(lz) > c.hd + 2.5 * d) continue;
        cells.add(iz * res + ix);
      }
    }
    const verts: number[] = [], idx: number[] = [];
    const ox = this.frame.x, oz = this.frame.z;
    const tri = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number): void => {
      const ay = heightAt(ax, az), by = heightAt(bx, bz), cy = heightAt(cx, cz);
      if (hole(ax, ay, az, bx, by, bz, cx, cy, cz)) return;
      const b = verts.length / 3;
      verts.push(ax - ox, ay, az - oz, bx - ox, by, bz - oz, cx - ox, cy, cz - oz);
      idx.push(b, b + 1, b + 2);
    };
    for (const cell of cells) {
      const ix = cell % res, iz = Math.floor(cell / res);
      const x0 = ix * d - half, x1 = x0 + d, z0 = iz * d - half, z1 = z0 + d;
      tri(x0, z0, x0, z1, x1, z0); tri(x0, z1, x1, z1, x1, z0);
    }
    if (idx.length === 0) return [];
    return [{ kind: 'trimesh', x: ox, y: 0, z: oz, vertices: Float32Array.from(verts), indices: Uint32Array.from(idx), surface: this.look.surface }];
  }

  /** Build the shaft and the drips (hidden until the eye is near); they are added to `fx` in that order. */
  buildFx(): void {
    const meta = this.meta, look = this.look;
    const toW = (p: [number, number, number]): THREE.Vector3 => { const [x, z] = this.world(p[0], p[2]); return new THREE.Vector3(x, p[1], z); };
    // the shaft: an open cone from the crack to the floor, additive, brightest at the crack, fading to the floor and toward its rim
    const top = toW(meta.shaft.top), foot = toW(meta.shaft.foot);
    const len = top.distanceTo(foot);
    const geo = new THREE.CylinderGeometry(meta.shaft.r0, meta.shaft.r1, len, look.shaft.radialSegments, look.shaft.heightSegments, true);
    geo.translate(0, -len / 2, 0);
    const shaftMat = new THREE.ShaderMaterial({
      uniforms: { uI: { value: 0 }, uTime: { value: 0 }, uLen: { value: len } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: look.shaft.vertex,
      fragmentShader: look.shaft.fragment,
    });
    const shaft = new THREE.Mesh(geo, shaftMat);
    shaft.position.copy(top);
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), foot.clone().sub(top).normalize());
    shaft.renderOrder = look.shaft.renderOrder; shaft.frustumCulled = true; shaft.visible = false;
    shaft.name = 'cave-shaft';
    this.shaft = shaft;
    this.fx.push(shaft);
    // the drips: one Points, each drip falling from the roof on its own clock
    const n = meta.drips.length;
    if (n > 0) {
      const pos = new Float32Array(n * 3);
      this.dripState = new Float32Array(n * 4);
      meta.drips.forEach((d, i) => {
        const [x, z] = this.world(d[0], d[2]);
        this.dripState.set([x, d[1], z, d[3]], i * 4);
        pos.set([x, d[1], z], i * 3);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const dl = look.drips;
      const pm = new THREE.PointsMaterial({ color: dl.color, size: dl.size, sizeAttenuation: true, transparent: true, opacity: dl.opacity, depthWrite: false, fog: false });
      const pts = new THREE.Points(g, pm);
      pts.name = 'cave-drips'; pts.visible = false; pts.frustumCulled = false;
      this.drips = pts;
      this.fx.push(pts);
    }
  }

  /** Per frame, the eye at `p`: the sun's disc under the roof, and near the mouth the fill, the shaft and the drips on clock `t`. */
  update(t: number, p: THREE.Vector3, sky: SkyRig): void {
    const look = this.look;
    // the sun's corona sprite draws without a depth test: under the roof the disc goes, corona and all
    const [, lz] = this.local(p.x, p.z);
    const under = this.inside(p.x, p.z) && p.y < (this.floorAt(Math.min(look.under.lzMax, Math.max(look.under.lzMin, lz))) ?? p.y) + look.under.height;
    if (under !== this.under) {
      this.under = under;
      sky.sunDisc.visible = !under; // the corona has no depth test (and the disc is the god rays' source)
    }
    const near = Math.hypot(p.x - this.frame.x, p.z - this.frame.z) < look.near;
    if (near !== this.near) { this.near = near; if (this.shaft) this.shaft.visible = near; if (this.drips) this.drips.visible = near; }
    if (!near) return;
    if (this.shaft && this.shaft.material instanceof THREE.ShaderMaterial) {
      const u = this.shaft.material.uniforms, s = look.shaft;
      // the sky over the crack: bright by day (the lamps are out), a glimmer at night
      const day = 1 - Math.max(0, Math.min(1, sky.lamps));
      const uI = u['uI'], uT = u['uTime'];
      this.fill.value = look.fill[0] + look.fill[1] * day;
      if (uI) uI.value = s.gain * day * Math.min(1, s.sunBase + Math.max(0, sky.sunDir.y) * s.sunGain) + s.floor;
      if (uT) uT.value = t;
    }
    if (this.drips) {
      const pos = this.drips.geometry.getAttribute('position');
      const st = this.dripState, n = st.length / 4, dl = look.drips;
      for (let i = 0; i < n; i++) {
        const top = st[i * 4 + 1] ?? 0, floor = st[i * 4 + 3] ?? 0, h = Math.max(dl.minDrop, top - floor);
        // each drip: forms for a while (hangs at the roof), then falls under gravity to the floor
        const period = dl.period + (i % dl.kinds) * dl.periodStep, ph = (t / period + i * dl.phaseStep) % 1;
        const fall = Math.sqrt((2 * h) / dl.gravity) / period;
        const k = ph < 1 - fall ? 0 : (ph - (1 - fall)) / fall;
        pos.setY(i, top - dl.hang - 0.5 * dl.gravity * (k * fall * period) ** 2 * (k > 0 ? 1 : 0));
      }
      pos.needsUpdate = true;
    }
  }
}
