/**
 * The bear cave's arch (E315 M2): a TRELLIS.2 generation (PINE-HOLLOW-REMASTER PH-B3,
 * public/assets/models/pine-hollow-hero/cave-arch/ + its LOD1): a rock arch with its mouth facing local +Z. It was
 * generated with the mouth closed; set into the Den's wall in front of the Blender cave (PH-B2) it is opened —
 * `openCaveArch` drops every triangle inside the passage's section, its jambs and lintel stay. Without the cave (a build
 * without the crag kit) it stays shut: the `closed` variant, a dark plane just inside its opening and a back wall.
 * It collides as two jambs and a lintel (boxes from its LOD1's bounds), rock. LOD0 (with shadow) within 70 m, LOD1 past.
 */
import * as THREE from 'three';
import { defineModel, type ColliderSpec, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { BEAR_CAVE } from '../layout';
import { heroFar, heroLod0, heroLod1, heroNear } from '../world/hero';

export interface CaveArchParams {
  /** as generated: the mouth shut (no cave behind it) */
  readonly closed: boolean;
}

/** the arch's bounds (its LOD1's, lined up with LOD0: the colliders' frame) */
function archBox(ctx: ModelContext): THREE.Box3 | null { return (heroLod1(ctx, 'cave-arch') ?? heroLod0(ctx, 'cave-arch'))?.box ?? null; }

/** the closed arch's dark plane just inside its opening (the chinking's program) */
function darkPlane(ctx: ModelContext): ModelPart[] {
  const b = archBox(ctx);
  if (!b) return [];
  const w = b.max.x - b.min.x, h = b.max.y - b.min.y, d = b.max.z - b.min.z;
  return ctx.once('pine-hollow/cave-arch:dark', () => {
    const material = new THREE.MeshStandardMaterial({ color: 0x040404, roughness: 1, metalness: 0 });
    ctx.sky.setupMaterial(material);
    return [{ geometry: new THREE.PlaneGeometry(w * 0.5, h * 0.72).translate(0, h * 0.36, d * 0.05), material }];
  });
}

/**
 * Open the arch into the cave behind it (both LODs, once): every triangle inside the passage's section goes — cave
 * frame (BEAR_CAVE, its mouth facing (−sin rot, −cos rot)): |lx| < 2.6, from the floor to 4.8 m up, from 0.6 m inside
 * its lip back. `m` is the arch's placement, `floorY` the ground at the cave's mouth.
 */
export function openCaveArch(ctx: ModelContext, m: THREE.Matrix4, floorY: number): void {
  ctx.once('pine-hollow/cave-arch:open', () => {
    for (const l of [heroLod0(ctx, 'cave-arch'), heroLod1(ctx, 'cave-arch')]) if (l) hollow(l.geometry, m, floorY);
    return true;
  });
}

function hollow(g: THREE.BufferGeometry, m: THREE.Matrix4, floorY: number): void {
  const pos = g.getAttribute('position'), idx = g.getIndex();
  const tri = idx ? idx.count / 3 : pos.count / 3, at = (k: number): number => (idx ? idx.getX(k) : k);
  const c = Math.cos(BEAR_CAVE.rot), s = Math.sin(BEAR_CAVE.rot), v = new THREE.Vector3(), keep: number[] = [];
  for (let t = 0; t < tri; t++) {
    let lxs = 0, lzs = 0, ys = 0;
    for (let k = 0; k < 3; k++) {
      v.fromBufferAttribute(pos, at(t * 3 + k)).applyMatrix4(m);
      const dx = v.x - BEAR_CAVE.x, dz = v.z - BEAR_CAVE.z;
      lxs += dx * c - dz * s; lzs += dx * s + dz * c; ys += v.y;
    }
    const lx = lxs / 3, lz = lzs / 3, y = ys / 3 - floorY;
    if (Math.abs(lx) < 2.6 && y > -0.3 && y < 4.8 && lz > -0.6) continue;
    keep.push(at(t * 3), at(t * 3 + 1), at(t * 3 + 2));
  }
  g.setIndex(keep);
}

export const caveArch = defineModel<CaveArchParams>({
  id: 'pine-hollow/cave-arch', name: 'Cave arch', category: 'nature', pipeline: 'trellis',
  file: 'src/shards/pine-hollow/models/caveArch.ts', surface: 'rock',
  defaults: { closed: false },
  variants: [{ id: 'open', label: 'Open (the cave behind)', params: { closed: false } }, { id: 'closed', label: 'Closed (no cave)', params: { closed: true } }],
  build: (ctx, p) => [...heroNear(ctx, 'cave-arch'), ...(p.closed ? darkPlane(ctx) : [])],
  lods: [{ from: 70, build: (ctx, p) => [...heroFar(ctx, 'cave-arch'), ...(p.closed ? darkPlane(ctx) : [])] }],
  // the rock round the opening: two jambs and a lintel; shut, a back wall too
  colliders: (p, ctx) => {
    const b = archBox(ctx);
    if (!b) return [];
    const w = b.max.x - b.min.x, h = b.max.y - b.min.y, d = b.max.z - b.min.z;
    const out: ColliderSpec[] = [-1, 1].map((sx) => ({ kind: 'box', x: sx * w * 0.36, y: h * 0.5, z: 0, hx: w * 0.14, hy: h * 0.5, hz: d * 0.45, surface: 'rock' }));
    out.push({ kind: 'box', x: 0, y: h * 0.86, z: 0, hx: w * 0.5, hy: h * 0.14, hz: d * 0.45, surface: 'rock' });
    if (p.closed) out.push({ kind: 'box', x: 0, y: h * 0.4, z: -d * 0.1, hx: w * 0.24, hy: h * 0.4, hz: 0.3, surface: 'rock' });
    return out;
  },
});
