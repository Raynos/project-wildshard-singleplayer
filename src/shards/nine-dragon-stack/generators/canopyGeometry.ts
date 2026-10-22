// The banyan's canopy geometry (dome B, E169; moved from world/canopy.ts in G285): the lumps' cloud-shelf plan and the
// painted cards, the leaves and the shells dressed over them. Build-time only: ./specimens.ts bakes the world's crown and
// the banyan model's (public/assets/nine-dragon/baked/specimens.bin); the page draws them in its foliage program
// (../world/canopy.ts `buildCanopy`).
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Vector3 } from 'three';
import { Rng } from '@wildshard/sdk/random';
/** one lump of foliage: centre, radii (x, y, z; axis-aligned), how high it sits on its shelf, a seed */
export interface Lump { c: Vector3; r: Vector3; up: number; seed: number; wash: number }

/** the canopy's bounding ellipsoid: "how deep inside the crown" darkens the leaves (the core is in shade) */
export interface Crown { c: Vector3; r: Vector3 }
export function crownOf(lumps: readonly Lump[]): Crown {
  const lo = new Vector3(Infinity, Infinity, Infinity), hi = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const l of lumps) { lo.min(l.c.clone().sub(l.r)); hi.max(l.c.clone().add(l.r)); }
  return { c: lo.clone().add(hi).multiplyScalar(0.5), r: hi.clone().sub(lo).multiplyScalar(0.5) };
}
const innerAt = (p: Vector3, k: Crown): number => {
  const q = p.clone().sub(k.c).divide(k.r);
  // 0 on the crown's skin, 1 at its heart; the underside counts as inside (it is in the crown's shadow)
  return Math.max(0, Math.min(1, 1 - q.length())) * 0.8 + Math.max(0, Math.min(1, -q.y)) * 0.35;
};

/** geometry writer: position, normal (= the SHADING normal: the lump's, not the card's), aUv (u, v, rim, _), aTone */
class Writer {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly uv: number[] = [];
  readonly tone: number[] = [];
  readonly lump: number[] = [];
  readonly idx: number[] = [];
  n = 0;
  /** the lump this geometry dresses: its centre and largest radius (the silhouette plateau) */
  on: Lump | null = null;
  v(p: Vector3, nrm: Vector3, u: number, v: number, rim: number, tone: number, inner: number): number {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(nrm.x, nrm.y, nrm.z);
    this.uv.push(u, v, rim, 0);
    this.tone.push(tone, inner);
    const l = this.on;
    if (l === null) this.lump.push(p.x, p.y, p.z, 0);
    else this.lump.push(l.c.x, l.c.y, l.c.z, Math.max(l.r.x, l.r.y, l.r.z));
    return this.n++;
  }
  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aUv', new Float32BufferAttribute(this.uv, 4));
    g.setAttribute('aTone', new Float32BufferAttribute(this.tone, 2));
    g.setAttribute('aLump', new Float32BufferAttribute(this.lump, 4));
    g.setAttribute('aSpill', new Float32BufferAttribute(new Float32Array(this.n * 3), 3));
    g.setIndex(new Uint32BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/** the ellipsoid normal of lump `l` at world point p (smooth across every card that sits on it) */
const lumpNormal = (l: Lump, p: Vector3): Vector3 => {
  const q = p.clone().sub(l.c);
  return new Vector3(q.x / (l.r.x * l.r.x), q.y / (l.r.y * l.r.y), q.z / (l.r.z * l.r.z)).normalize();
};
/** a random direction on the unit sphere, fewer on the underside (bias 0: uniform) */
const sphereDir = (rng: Rng, bias: number): Vector3 => {
  for (;;) {
    const d = new Vector3(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1));
    const l = d.length();
    if (l < 0.05 || l > 1) continue;
    d.divideScalar(l);
    const w = 1 - bias + bias * Math.min(1, Math.max(0, (d.y + 0.6) / 1.0));
    if (rng.next() < w) return d;
  }
};
const ellArea = (r: Vector3): number => {
  const p = 1.6;
  return 4 * Math.PI * (((r.x * r.y) ** p + (r.x * r.z) ** p + (r.y * r.z) ** p) / 3) ** (1 / p);
};

export interface CardOpt {
  /** cards per m² of lump surface */
  perM2: number;
  /** card edge (m) */
  size: number;
  /** how far out of the lump surface the card centres sit (× radius) */
  lift: [number, number];
  /** how much a card's plane leans away from the lump tangent (0 = tangent, 1 = random) */
  tilt: number;
  /** fewer cards on the underside (0 = uniform) */
  bias: number;
  /** atlas tiles across (2 = the codex 2×2 sheet) */
  tiles: number;
}
export const CARDS: CardOpt = { perM2: 3.6, size: 1.5, lift: [0.6, 1.0], tilt: 0.55, bias: 0.35, tiles: 2 };

/** painted leaf-cluster cards over every lump (double-sided quads; the shading normal is the lump's) */
export function cardGeometry(lumps: readonly Lump[], rng: Rng, o: CardOpt = CARDS): BufferGeometry {
  const w = new Writer();
  const crown = crownOf(lumps);
  const up = new Vector3(0, 1, 0);
  for (const l of lumps) {
    w.on = l;
    const n = Math.max(4, Math.round(ellArea(l.r) * o.perM2));
    const scale = 0.75 + 0.35 * Math.min(1, l.r.x / 1.1);
    for (let i = 0; i < n; i++) {
      const d = sphereDir(rng, o.bias);
      const p = l.c.clone().add(d.clone().multiply(l.r).multiplyScalar(rng.range(o.lift[0], o.lift[1])));
      const ln = lumpNormal(l, p);
      const cn = ln.clone().add(new Vector3(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).multiplyScalar(o.tilt)).normalize();
      // the cluster's stem end points down the lump (its fan opens outward and up), then a random swing
      let tu = up.clone().sub(cn.clone().multiplyScalar(up.dot(cn)));
      if (tu.lengthSq() < 0.04) tu = new Vector3(rng.range(-1, 1), 0, rng.range(-1, 1)).sub(cn.clone().multiplyScalar(0.0));
      tu.sub(cn.clone().multiplyScalar(tu.dot(cn))).normalize();
      tu.applyAxisAngle(cn, rng.range(-0.7, 0.7));
      const tr = new Vector3().crossVectors(tu, cn).normalize();
      const s = o.size * scale * rng.range(0.8, 1.2);
      const tile = rng.int(0, o.tiles * o.tiles - 1);
      const u0 = (tile % o.tiles) / o.tiles, v0 = Math.floor(tile / o.tiles) / o.tiles, ts = 1 / o.tiles;
      const flip = rng.chance(0.5);
      const tone = rng.next();
      const base = w.n;
      for (const [cx, cy] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]] as const) {
        const q = p.clone().addScaledVector(tr, cx * s).addScaledVector(tu, cy * s);
        const uu = flip ? 0.5 - cx : cx + 0.5;
        // the atlas row 0 is the image top: v grows downward in the PNG, so the stem (image bottom) is v = 1 - …
        w.v(q, lumpNormal(l, q), u0 + uu * ts, 1 - (v0 + (0.5 - cy) * ts), 0, tone, innerAt(q, crown));
      }
      w.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  return w.build();
}

export interface LeafOpt { perM2: number; len: [number, number]; lift: [number, number]; bias: number; droop: number }
export const LEAVES: LeafOpt = { perM2: 45, len: [0.16, 0.26], lift: [0.85, 1.12], bias: 0.3, droop: 0.45 };

export interface ShellOpt { lat: number; lon: number; bumps: number; amp: number; shrink: number }
/** the lumps as the canopy core (shrink < 1, no bumps) or as scalloped cloud-shelves (bumps > 0) */
export const CORE: ShellOpt = { lat: 5, lon: 9, bumps: 0, amp: 0, shrink: 0.86 };
export function shellGeometry(lumps: readonly Lump[], rng: Rng, o: ShellOpt): BufferGeometry {
  const w = new Writer();
  const crown = crownOf(lumps);
  const d = new Vector3();
  for (const l of lumps) {
    w.on = l;
    const r = l.r.clone().multiplyScalar(o.shrink);
    const bumps: Vector3[] = [];
    for (let b = 0; b < o.bumps; b++) bumps.push(sphereDir(rng, 0.4));
    const bump = (dd: Vector3): number => {
      if (bumps.length === 0) return 1;
      // a scalloped rim: the max of round bumps (each one leaf cluster), a dip between them
      let m = 0;
      for (const b of bumps) { const t = Math.max(0, dd.dot(b)); m = Math.max(m, t * t * t * t); }
      return 1 + o.amp * (m - 0.35) - (dd.y < -0.3 ? 0.15 : 0);
    };
    const tone = rng.next();
    const base = w.n;
    for (let i = 0; i <= o.lat; i++) {
      const th = (i / o.lat) * Math.PI;
      for (let j = 0; j <= o.lon; j++) {
        const ph = (j / o.lon) * Math.PI * 2;
        d.set(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
        const k = bump(d);
        const p = l.c.clone().add(new Vector3(d.x * r.x * k, d.y * r.y * k, d.z * r.z * k));
        w.v(p, lumpNormal({ ...l, r }, p), j / o.lon, i / o.lat, 0, tone, innerAt(p, crown));
      }
    }
    for (let i = 0; i < o.lat; i++) {
      for (let j = 0; j < o.lon; j++) {
        const a = base + i * (o.lon + 1) + j, b = a + o.lon + 1;
        w.idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  return w.build();
}

/**
 * The canopy's geometry over a plan's lumps: the painted cards and the darker core under them — the world's crown and
 * the banyan model's (../models/banyan.ts, built over the tree's plan in its own space). The budget round: 2.6 cards per
 * m² (the lab's 3.6) and a lat 4 × lon 7 core (the lab's phone levers).
 */
export function canopyGeometries(lumps: readonly Lump[]): { cards: BufferGeometry; core: BufferGeometry } {
  const rng = new Rng(97);
  const cards = cardGeometry(lumps, rng, { ...CARDS, perM2: 2.6 });
  const core = shellGeometry(lumps, rng, { ...CORE, lat: 4, lon: 7 });
  return { cards, core };
}
