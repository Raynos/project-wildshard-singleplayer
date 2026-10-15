import type { TreeInstance } from '@wildshard/engine/world/forest/placement';

import type { AmbientLifeData } from '@wildshard/format/ambientLife';

export interface TrunkSection { x: number; z: number; r: number }

/** Query authored local trunk profiles on the actual planted tree transforms. */
export class TrunkProbe {
  constructor(private readonly rows: AmbientLifeData['perches']) {}
  private world(t: TreeInstance, k: { cx: number; cz: number }): { x: number; z: number } {
    const c = Math.cos(t.rot), s = Math.sin(t.rot);
    return { x: t.x + (k.cx * c + k.cz * s) * t.scale, z: t.z + (-k.cx * s + k.cz * c) * t.scale };
  }

  /** the trunk's centre + bark radius at world height `y` on tree `t` (null: no bark there — above the spine's top) */
  section(t: TreeInstance, y: number): TrunkSection | null {
    const STEP = this.rows.step, sp = this.rows.spines[t.variant] ?? [], hl = (y - t.y) / t.scale;
    const i = Math.floor(hl / STEP) - 1, a = sp[Math.max(0, i)], b = sp[i + 1];
    if (a === undefined || hl < 0) return null;
    const k = b === undefined ? a : (() => { const u = Math.min(1, Math.max(0, (hl - a.y) / STEP)); return { cx: a.cx + (b.cx - a.cx) * u, cz: a.cz + (b.cz - a.cz) * u, r: a.r + (b.r - a.r) * u }; })();
    if (b === undefined && hl > a.y + STEP) return null;
    return { ...this.world(t, k), r: k.r * t.scale };
  }

  /** the top of the bark (a snag's broken crown) in world space, or null */
  top(t: TreeInstance): { x: number; y: number; z: number } | null {
    const STEP = this.rows.step, sp = this.rows.spines[t.variant] ?? [], k = sp[sp.length - 1];
    if (k === undefined) return null;
    return { ...this.world(t, k), y: t.y + (k.y + STEP * 0.5) * t.scale };
  }
}
