/**
 * Spruce — a Tian Shan spruce (Picea schrenkiana) for Nalati's gullies, in the painterly style (style B).
 *
 * Tall, narrow, dark blue-green spires of drooping tiers. Every tier is a smooth skirt: a lit upper surface that
 * leaves the trunk and sags to a ragged rim of branch tips, then a dark underside tucked back to the trunk — so
 * the crown reads as the painted bands of the mockups (art/nalati-grasslands/round-1/1-art-style/
 * style-B-painterly.png): light tier tops, deep shade under each one. No cards, no alpha, no textures: vertex colour
 * on the shared painterly material (`src/world/painterly.ts`: cel bands, painted shade, rim light, wind sway).
 * Heights 10.5–18.5 m (× the forest's 0.8–1.2 scale): the design's 12–20 m forced-perspective spruce
 * (docs/design/nalati/geography-and-map.md §2 B) on a 40 m escarpment.
 *
 * It is a `TreeFactory` — the engine `Forest` draws it (placement, LOD bands, culling, collision, canopy map):
 *   ChunkDef.trees.factory = 'spruce'   → `TREE_FACTORIES.spruce` in src/core/bootstrap.ts builds it
 *   ChunkDef.forest.mask = spruceMask() → src/world/spruceMask.ts plants it in the gullies only
 *
 * LODs per variant (tris for the 15 m variant; `SpruceFactory.lodTris` has all four):
 *   cardsHi  the full crown: 13 tiers × 16 tips, 4 bands (upper ×2, underside ×2)  ≈ 1.7 k
 *   twigs    near field only (Forest's twig distance): painted highlight strokes on the tier tops ≈ 0.2 k
 *   cardsLo  8 tiers × 8 tips, 2 bands                                                ≈ 0.26 k
 *   far      4 tiers × 6 tips, 2 bands — solid, not an impostor (no bake, no alpha)    ≈ 0.1 k
 *   trunk    7-sided tapered cone with a root flare                                    ≈ 0.1 k
 * Draws: on the batched path (WEBGL_multi_draw) every spruce on the shard is 4 draws + 3 shadow draws; the
 * instanced fallback is up to 6 lists × 4 variants.
 */
import * as THREE from 'three';
import { Rng } from '../core/rng';
import { smoothstep } from '../core/noise';
import { TreeFactory, type TreeVariant } from './TreeFactory';
import { TREE_SPECS } from './placement';
import { painterlyMaterial } from './painterly';
import type { Sky } from './Sky';

/**
 * The four spruce variants. The trunk radii are placement.ts' TREE_SPECS radii (in the same order) on purpose:
 * scripts/bake-chunk.mjs plants the shard's forest with TREE_SPECS to bake the undergrowth decision log, and a
 * tree's trunk radius is the only variant number that log depends on.
 */
export const SPRUCE_SPECS = [
  { height: 15, trunk: TREE_SPECS[0].trunk, seed: 11 },
  { height: 12.5, trunk: TREE_SPECS[1].trunk, seed: 12 },
  { height: 18.5, trunk: TREE_SPECS[2].trunk, seed: 13 },
  { height: 10.5, trunk: TREE_SPECS[3].trunk, seed: 14 },
] as const;

/** The painted palette (sRGB → linear by three): undersides, the core by the trunk, the upper surface, the lit tips. */
const PAL = {
  deep: new THREE.Color('#14302a'),
  inner: new THREE.Color('#183a30'),
  mid: new THREE.Color('#1f4432'),
  tip: new THREE.Color('#3c6a40'),
  tipWarm: new THREE.Color('#4f6f3e'),
  stroke: new THREE.Color('#679652'),
  strokeWarm: new THREE.Color('#7a9453'),
  barkLow: new THREE.Color('#2a211b'),
  barkHigh: new THREE.Color('#553e2f'),
};

/** Indexed geometry accumulator: position, normal, vertex colour. `tri` winds each face to its vertex normals. */
class GeoBuilder {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  private idx: number[] = [];

  vert(x: number, y: number, z: number, n: THREE.Vector3, c: THREE.Color): number {
    this.pos.push(x, y, z); this.nor.push(n.x, n.y, n.z); this.col.push(c.r, c.g, c.b);
    return this.pos.length / 3 - 1;
  }

  tri(a: number, b: number, c: number): void {
    const p = this.pos, n = this.nor;
    const ax = p[a * 3] ?? 0, ay = p[a * 3 + 1] ?? 0, az = p[a * 3 + 2] ?? 0;
    const ux = (p[b * 3] ?? 0) - ax, uy = (p[b * 3 + 1] ?? 0) - ay, uz = (p[b * 3 + 2] ?? 0) - az;
    const vx = (p[c * 3] ?? 0) - ax, vy = (p[c * 3 + 1] ?? 0) - ay, vz = (p[c * 3 + 2] ?? 0) - az;
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    let dot = 0;
    for (const k of [a, b, c]) dot += fx * (n[k * 3] ?? 0) + fy * (n[k * 3 + 1] ?? 0) + fz * (n[k * 3 + 2] ?? 0);
    if (dot >= 0) this.idx.push(a, b, c); else this.idx.push(a, c, b);
  }

  quad(a: number, b: number, c: number, d: number): void { this.tri(a, b, c); this.tri(a, c, d); }

  get triangles(): number { return this.idx.length / 3; }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setIndex(this.idx);
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

interface CrownLod {
  tiers: number;
  /** branch tips around a tier (even = a long drooping branch, odd = the notch between two) */
  tips: number;
  /** hi: the upper surface in two bands (root → mid → rim) and the underside in two; else one band each */
  full: boolean;
}

const _n = new THREE.Vector3(), _c = new THREE.Color();

/** A radial normal: `out` outward along (cos a, sin a), `up` vertical, normalised. */
const radial = (a: number, out: number, up: number) => _n.set(Math.cos(a) * out, up, Math.sin(a) * out).normalize();

/** The tree's shape numbers — one stream per variant, shared by every LOD so the silhouettes agree. */
function crownShape(height: number, seed: number) {
  const r = new Rng(seed * 131 + 7);
  return {
    base: height * r.range(0.04, 0.08),                           // the skirt sweeps almost to the ground
    rMax: Math.min(3.3, height * r.range(0.14, 0.16)),            // narrow: crown width ≈ height / 3.3
    leanX: r.range(-0.3, 0.3), leanZ: r.range(-0.3, 0.3),
    wob: r.range(0, 100),
  };
}

/**
 * One tree's crown into `b` (and its highlight strokes into `strokes`, hi only). The tier radii come from a smooth function
 * of height (not the rng), so hi, lo and far share their outline and only lose tips, tiers and bands.
 */
function buildCrown(b: GeoBuilder, strokes: GeoBuilder | null, height: number, trunkR: number, seed: number, lod: CrownLod): void {
  const { base, rMax, leanX, leanZ, wob } = crownShape(height, seed);
  const topY = height * 0.92;
  const N = lod.tiers, T = lod.tips;
  const dy = (topY - base) / N;
  const rng = new Rng(seed * 977 + lod.tiers * 31 + lod.tips); // per-LOD jitter (tips, phases)
  const lean = (y: number) => (y / height) ** 2;
  const trunkAt = (y: number) => trunkR * (1 - y / height) + 0.06;
  for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N;                                     // 0 = the bottom tier, 1 = the top
    const yA = base + dy * (i + 1);                              // where the tier leaves the trunk
    // a narrow spire, fullest a little above the ground; a slow wobble so the outline is not a ruler-straight cone
    const profile = (1 - u) ** 0.68 * (0.9 + 0.1 * smoothstep(0, 0.25, u)) * (1 + 0.07 * Math.sin(u * 19 + wob));
    const R = Math.max(0.3, rMax * profile);
    const drop = dy * (1.4 + 0.3 * (1 - u)) + R * 0.1;           // the branches sag; each rim hangs over the tier below
    const phase = rng.range(0, (Math.PI * 2) / T);
    const ao = 0.6 + 0.4 * smoothstep(0, 0.9, u);                // the lower crown sits in its own shade
    const lx = leanX * lean(yA), lz = leanZ * lean(yA);
    const tone = (c: THREE.Color, k: number) => _c.copy(c).multiplyScalar(ao * k);
    const warm = rng.next() < 0.4;
    const ringA: number[] = [], ringB: number[] = [], ringCt: number[] = [], ringCb: number[] = [], ringD: number[] = [], ringE: number[] = [];
    for (let k = 0; k < T; k++) {
      const long = k % 2 === 0;
      const a = phase + (k / T) * Math.PI * 2 + rng.range(-0.12, 0.12);
      const cs = Math.cos(a), sn = Math.sin(a);
      const rk = R * (long ? rng.range(0.94, 1.08) : rng.range(0.82, 0.9) + (lod.full ? 0 : 0.04));
      const dk = drop * (long ? rng.range(0.96, 1.1) : rng.range(0.8, 0.88));
      const at = (r: number, y: number): [number, number, number] => [lx + cs * r, y, lz + sn * r];
      // A: the tier's root on the trunk
      ringA.push(b.vert(...at(trunkAt(yA), yA + dy * 0.1), radial(a, 0.35, 1), tone(PAL.inner, 1)));
      // B: halfway out, the branch still level-ish before it sags (hi only)
      if (lod.full) ringB.push(b.vert(...at(rk * 0.5, yA - dk * 0.28), radial(a, 0.55, 0.85), tone(PAL.mid, 1.05)));
      // C: the branch tip — twice: lit from above (C top) and in shade from below (C bottom), the painted band edge
      const tipC = long ? (warm ? PAL.tipWarm : PAL.tip) : PAL.mid;
      ringCt.push(b.vert(...at(rk, yA - dk), radial(a, 0.9, 0.45), tone(tipC, 1)));
      ringCb.push(b.vert(...at(rk, yA - dk), radial(a, 0.7, -0.7), tone(PAL.mid, 0.85)));
      // D: the underside tucked back toward the trunk (hi only), E: back on the trunk under the tier
      if (lod.full) ringD.push(b.vert(...at(rk * 0.5, yA - dk * 0.68), radial(a, 0.35, -0.9), tone(PAL.deep, 1)));
      const ye = yA - drop * 0.4;
      ringE.push(b.vert(...at(trunkAt(ye), ye), radial(a, 0.2, -1), tone(PAL.deep, 0.8)));
      // painted highlight strokes on the tier's upper surface along a long branch (near field): the lit dabs of the
      // mockup's spruces — thin slivers lying just above the surface, lighter than it, from mid-branch to the tip
      if (strokes && long && i > 0) {
        for (const off of [-0.09, 0.09]) {
          const a2 = a + off * rng.range(0.6, 1.2), c2 = Math.cos(a2), s2 = Math.sin(a2);
          const sx = -s2 * rk * 0.05, sz = c2 * rk * 0.05;
          const nrm = radial(a2, 0.6, 0.8);
          const col = tone(warm ? PAL.strokeWarm : PAL.stroke, rng.range(0.9, 1.1));
          const f0 = rng.range(0.35, 0.5), f1 = rng.range(0.85, 0.95);
          const y0 = yA - dk * 0.28 * (f0 / 0.5) + 0.07, y1 = yA - dk * (0.28 + 0.72 * (f1 - 0.5) / 0.5) + 0.07;
          const s0 = strokes.vert(lx + c2 * rk * f0 + sx, y0, lz + s2 * rk * f0 + sz, nrm, col);
          const s1 = strokes.vert(lx + c2 * rk * f0 - sx, y0, lz + s2 * rk * f0 - sz, nrm, col);
          const s3 = strokes.vert(lx + c2 * rk * f1, y1, lz + s2 * rk * f1, nrm, col);
          strokes.tri(s0, s1, s3);
        }
      }
    }
    const band = (inner: number[], outer: number[]) => {
      for (let k = 0; k < T; k++) {
        const k1 = (k + 1) % T;
        const a0 = inner[k], a1 = inner[k1], b0 = outer[k], b1 = outer[k1];
        if (a0 === undefined || a1 === undefined || b0 === undefined || b1 === undefined) continue;
        b.quad(a0, b0, b1, a1);
      }
    };
    if (lod.full) { band(ringA, ringB); band(ringB, ringCt); band(ringCb, ringD); band(ringD, ringE); } else { band(ringA, ringCt); band(ringCb, ringE); }
  }
  // the leader: a thin spike above the top tier
  const S = Math.max(4, Math.round(T / 3)), yL0 = topY - dy * 0.4;
  const tipV = b.vert(leanX, height, leanZ, _n.set(0, 1, 0), _c.copy(PAL.tip));
  const ring: number[] = [];
  for (let k = 0; k < S; k++) {
    const a = (k / S) * Math.PI * 2;
    ring.push(b.vert(leanX * lean(yL0) + Math.cos(a) * 0.14, yL0, leanZ * lean(yL0) + Math.sin(a) * 0.14, radial(a, 1, 0.3), _c.copy(PAL.mid)));
  }
  for (let k = 0; k < S; k++) { const r0 = ring[k], r1 = ring[(k + 1) % S]; if (r0 !== undefined && r1 !== undefined) b.tri(r0, r1, tipV); }
}

/** A 7-sided tapered trunk with a root flare, dark at the foot, warmer red-brown up in the crown (ends below the leader). */
function buildTrunk(height: number, trunkR: number, seed: number): THREE.BufferGeometry {
  const b = new GeoBuilder();
  const { leanX, leanZ } = crownShape(height, seed);
  const S = 7, rows = 5, top = height * 0.72;
  const grid: number[][] = [];
  for (let j = 0; j <= rows; j++) {
    const t = j / rows, y = -0.5 + (top + 0.5) * t;
    const flare = t < 0.12 ? (0.12 - t) * 3.2 * trunkR : 0;
    const r = trunkR * (1 - y / height) + 0.05 + flare;
    const l = (y / height) ** 2;
    const col = _c.copy(PAL.barkLow).lerp(PAL.barkHigh, smoothstep(0.02, 0.4, t));
    const row: number[] = [];
    for (let k = 0; k < S; k++) {
      const a = (k / S) * Math.PI * 2;
      row.push(b.vert(leanX * l + Math.cos(a) * r, y, leanZ * l + Math.sin(a) * r, radial(a, 1, 0.1), col));
    }
    grid.push(row);
  }
  for (let j = 0; j < rows; j++) {
    const r0 = grid[j], r1 = grid[j + 1];
    if (!r0 || !r1) continue;
    for (let k = 0; k < S; k++) {
      const a0 = r0[k], a1 = r0[(k + 1) % S], b0 = r1[k], b1 = r1[(k + 1) % S];
      if (a0 !== undefined && a1 !== undefined && b0 !== undefined && b1 !== undefined) b.quad(a0, a1, b1, b0);
    }
  }
  return b.build();
}

/** Triangle counts per LOD for one variant (perf reports). */
export interface SpruceLodTris { hi: number; twigs: number; lo: number; far: number; trunk: number }

export class SpruceFactory extends TreeFactory {
  /** tris per LOD, per variant (the order of `variants`) */
  lodTris: SpruceLodTris[] = [];

  constructor(renderer: THREE.WebGLRenderer, private readonly sky: Sky) { super(renderer); }

  override build(): Promise<this> {
    // the shared painterly material (one program, four uniform sets). Spruce is stiff: ~0.35 m of sway at the top of
    // an 18 m tree (painterly's sway is metres per metre² of height), a warm rim on the sun side of the spires.
    const sway = 0.0011;
    this.needleMaterial = painterlyMaterial(this.sky, { rim: 0.2, bands: 0.85, sway });
    this.twigMaterial = painterlyMaterial(this.sky, { rim: 0.1, bands: 0.85, sway });
    this.farMaterial = painterlyMaterial(this.sky, { rim: 0.25, bands: 0.7, sway });
    this.barkMaterial = painterlyMaterial(this.sky, { rim: 0.15, bands: 0.8, sway: sway * 0.4 });
    // shadows: the plain depth pass (painterly's own shadow-depth does not sway either)
    this.needleDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    this.twigDepth = this.needleDepth;

    for (const s of SPRUCE_SPECS) {
      const tiers = Math.round(s.height / 1.3);
      const hi = new GeoBuilder(), tw = new GeoBuilder(), lo = new GeoBuilder(), far = new GeoBuilder();
      buildCrown(hi, tw, s.height, s.trunk, s.seed, { tiers, tips: 12, full: true });
      buildCrown(lo, null, s.height, s.trunk, s.seed, { tiers: Math.round(tiers * 0.7), tips: 8, full: false });
      buildCrown(far, null, s.height, s.trunk, s.seed, { tiers: 4, tips: 6, full: false });
      const trunk = buildTrunk(s.height, s.trunk, s.seed);
      const v: TreeVariant = { trunk, cardsHi: hi.build(), cardsLo: lo.build(), twigs: tw.build(), far: far.build(), height: s.height, trunkRadius: s.trunk };
      this.variants.push(v);
      this.lodTris.push({ hi: hi.triangles, twigs: tw.triangles, lo: lo.triangles, far: far.triangles, trunk: (trunk.index?.count ?? 0) / 3 });
    }
    return Promise.resolve(this);
  }
}
