/**
 * Where a tree's bark actually is (PH-M5): the woodpecker clings to it and the owl sits on a snag's broken top. The
 * placement record (`TreeInstance`: x, z, the capsule radius) is the collider's, not the model's — a Blender snag leans
 * and forks, so a bird set at `r` from (x, z) hangs in the air. This walks the variant's own trunk geometry instead, once
 * per variant: a SPINE, from the base up every 0.5 m, of where a horizontal plane cuts the bark (the triangles' crossing
 * points within reach of the spine so far — a limb reaching out is left out), its median centre and radius; the spine
 * ends where the bark near it ends (a snag's broken top). World = the variant's local answer turned by the tree's `rot`,
 * scaled, moved to its base (Forest.ts composes the instance the same way).
 */
import type * as THREE from 'three';
import type { TreeInstance } from '../../world/placement';

export interface TrunkSection { x: number; z: number; r: number }
interface Knot { y: number; cx: number; cz: number; r: number }

const STEP = 0.5;
const median = (a: number[]): number => { if (a.length === 0) return 0; const s = a.slice().sort((p, q) => p - q); return s[Math.floor(s.length / 2)] ?? 0; };

/** the spine of one trunk geometry (local space) */
export function trunkSpine(g: THREE.BufferGeometry): Knot[] {
  const pos = g.getAttribute('position'), index = g.getIndex();
  const tri = index ? index.count / 3 : pos.count / 3;
  const vi = (k: number): number => (index ? index.getX(k) : k);
  let top = 0;
  for (let i = 0; i < pos.count; i++) top = Math.max(top, pos.getY(i));
  const spine: Knot[] = [];
  let cx = 0, cz = 0, r = 0.3;
  const xs: number[] = [], zs: number[] = [];
  for (let y = STEP; y < top; y += STEP) {
    xs.length = 0; zs.length = 0;
    const reach = Math.max(0.6, r * 2.5) + 0.25;
    for (let t = 0; t < tri; t++) {
      for (let e = 0; e < 3; e++) {
        const a = vi(t * 3 + e), b = vi(t * 3 + ((e + 1) % 3));
        const ya = pos.getY(a), yb = pos.getY(b);
        if ((ya - y) * (yb - y) > 0 || ya === yb) continue;
        const u = (y - ya) / (yb - ya), x = pos.getX(a) + (pos.getX(b) - pos.getX(a)) * u, z = pos.getZ(a) + (pos.getZ(b) - pos.getZ(a)) * u;
        if (Math.hypot(x - cx, z - cz) > reach) continue;
        xs.push(x); zs.push(z);
      }
    }
    if (xs.length < 4) break; // the bark near the spine ends here
    const mx = median(xs), mz = median(zs);
    const rr = median(xs.map((x, k) => Math.hypot(x - mx, (zs[k] ?? mz) - mz)));
    cx = mx; cz = mz; r = rr;
    spine.push({ y, cx, cz, r });
  }
  return spine;
}

export class TrunkProbe {
  private spines = new Map<number, Knot[]>();
  constructor(private readonly variants: readonly { trunk: THREE.BufferGeometry }[]) {}

  private spine(variant: number): Knot[] {
    let s = this.spines.get(variant);
    if (s === undefined) { const g = this.variants[variant]?.trunk; s = g ? trunkSpine(g) : []; this.spines.set(variant, s); }
    return s;
  }
  private world(t: TreeInstance, k: { cx: number; cz: number }): { x: number; z: number } {
    const c = Math.cos(t.rot), s = Math.sin(t.rot);
    return { x: t.x + (k.cx * c + k.cz * s) * t.scale, z: t.z + (-k.cx * s + k.cz * c) * t.scale };
  }

  /** the trunk's centre + bark radius at world height `y` on tree `t` (null: no bark there — above the spine's top) */
  section(t: TreeInstance, y: number): TrunkSection | null {
    const sp = this.spine(t.variant), hl = (y - t.y) / t.scale;
    const i = Math.floor(hl / STEP) - 1, a = sp[Math.max(0, i)], b = sp[i + 1];
    if (a === undefined || hl < 0) return null;
    const k = b === undefined ? a : (() => { const u = Math.min(1, Math.max(0, (hl - a.y) / STEP)); return { cx: a.cx + (b.cx - a.cx) * u, cz: a.cz + (b.cz - a.cz) * u, r: a.r + (b.r - a.r) * u }; })();
    if (b === undefined && hl > a.y + STEP) return null;
    return { ...this.world(t, k), r: k.r * t.scale };
  }

  /** the top of the bark (a snag's broken crown) in world space, or null */
  top(t: TreeInstance): { x: number; y: number; z: number } | null {
    const sp = this.spine(t.variant), k = sp[sp.length - 1];
    if (k === undefined) return null;
    return { ...this.world(t, k), y: t.y + (k.y + STEP * 0.5) * t.scale };
  }
}
