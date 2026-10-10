// Lantern Square's parts that are models too (E306 / E346): the Well's balustrade with its carved panels and lotus-bud
// finials and the mahjong table, drawn by the layout (./square.ts) and, in their own space, by the models' specimens
// (../models/wellBalustrade.ts, balustradePanel.ts, lotusFinial.ts, inKit.ts) — both build-time (G285: the specimens are
// baked, ./specimens.ts; the hip roof the entry decks still draw at load is ../world/hipRoof.ts).
import { Box3, type BufferGeometry, Matrix4, Quaternion, Vector3 } from 'three';
import { SURF } from '../look/paint';
import { lionOnPost, placeSet } from '../world/props3d';
import { KitX, merge } from '../world/hero/kitx';
import { K, Kit, type Look } from '../world/kit';
import { PLAZA, STREET, WELL } from '../layout';
import type { Rng } from '@wildshard/engine/core/rng';

// the balustrade's stone: a mid wet grey (dome A's ΔE: 0x76767b rendered #757784, 0x4a4c53 #44454e; the spawn target #656469)
const STONE: Look = { wash: 0x626469, kind: K.stone, line: 1, wet: 0.55, surf: SURF.concrete };

// (E281 pass 6: a shade darker than the posts — the buds are the nearest stone in A1·7, A2·4 and mockup A, and at
// 0x66676c they read as pale eggs against the targets' weathered buds)
const BUD: Look = { wash: 0x505157, kind: K.stone, line: 1, wet: 0.45, surf: SURF.concrete };

/** the carved panel's width in its own frame (the plaza run's gap between posts); each copy is scaled to its gap */
const PANEL_W = 1.86, PANEL_H = 0.6;

const CARVE: Look = { wash: 0x767880, line: 1, wet: 0.35, surf: SURF.concrete };

/**
 * E281 round 2: one carved balustrade panel face, drawn instanced on every panel, both faces (props3d.ts `placeSet`).
 * The targets' panels are deep carvings in a raised frame: a pair of big ruyi scrolls curling in from the ends, a lotus
 * medallion in the middle, small scrolls in the corners. In its own frame: the face on z = 0 facing +z, x across
 * (−PANEL_W/2 … PANEL_W/2), y up from the panel's foot. One geometry for all ~56 faces, where the per-panel dragon
 * reliefs cost ~190 vertices a panel in the square's kit.
 */
export function carvedPanel(far = false): BufferGeometry {
  const k = new Kit(), x = new KitX();
  const hw = PANEL_W / 2, Z = new Vector3(0, 0, 1);
  // the raised frame: rails and stiles standing 4 cm proud
  k.box(0, 0.03, 0.02, PANEL_W - 0.06, 0.06, 0.04, CARVE, { bottom: null });
  k.box(0, PANEL_H - 0.09, 0.02, PANEL_W - 0.06, 0.06, 0.04, CARVE, { bottom: null });
  for (const sx of [-1, 1]) k.box(sx * (hw - 0.06), 0.09, 0.02, 0.06, PANEL_H - 0.18, 0.04, CARVE, { top: null, bottom: null });
  const mid = PANEL_H / 2;
  // (E283, the thin-detail LOD) far off, the scrolls (2–5 cm strokes) are gone; the medallion stays
  const spiral = (cx: number, cy: number, r0: number, turns: number, dir: number, t0: number): void => {
    if (far) return;
    const pts: Vector3[] = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18, a = t0 + dir * t * turns * Math.PI * 2, r = r0 * (1 - 0.82 * t);
      pts.push(new Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.025));
    }
    x.sweep(pts, (t) => 0.024 * (1 - 0.5 * t), 4, CARVE, { flat: 0.5, up: Z.clone(), capEnd: true });
  };
  // the two big ruyi scrolls, their tails running in along the panel's middle to the medallion
  for (const sx of [-1, 1]) {
    spiral(sx * (hw - 0.34), mid, 0.17, 1.15, sx, sx > 0 ? Math.PI : 0);
    if (!far) x.sweep([new Vector3(sx * (hw - 0.34), mid - 0.17, 0.025), new Vector3(sx * 0.45, mid - 0.1, 0.025), new Vector3(sx * 0.2, mid, 0.025)], () => 0.02, 4, CARVE, { flat: 0.5, up: Z.clone() });
    // small scrolls in the corners toward the middle
    spiral(sx * 0.42, mid + 0.14, 0.07, 0.9, -sx, -Math.PI / 2);
  }
  // the lotus medallion: a petalled disc and a boss
  x.ellipsoid(new Vector3(0, mid, 0.02), new Vector3(1, 0, 0), new Vector3(0, 1, 0), Z, 0.15, 0.12, 0.035, CARVE, (d) => 1 + 0.16 * Math.abs(Math.cos(Math.atan2(d.y, d.x) * 4)), 3, 16);
  x.ellipsoid(new Vector3(0, mid, 0.05), new Vector3(1, 0, 0), new Vector3(0, 1, 0), Z, 0.05, 0.05, 0.03, CARVE, () => 1, 3, 8);
  return merge([k.build(), x.build()]);
}

export function carvedPanelFar(): BufferGeometry { return carvedPanel(true); }

/**
 * The Well's balustrade over the square and the street (E346: the model nine-dragon-stack/well-balustrade,
 * models/wellBalustrade.ts): the square's run and the street's, each along z at x = `at` from `a0` down to `a1`, its lions
 * on the run's posts (props3d.ts `lionOnPost`). Its placement stands at the corner where the two runs meet.
 */
export const WELL_RUNS: readonly { readonly at: number; readonly a0: number; readonly a1: number; readonly lions: 'plaza' | 'street' }[] = [
  { at: PLAZA.x0 + 0.2, a0: PLAZA.z1, a1: PLAZA.z0, lions: 'plaza' },
  { at: STREET.x0 + 0.2, a0: PLAZA.z0 - 0.1, a1: WELL.z0, lions: 'street' },
];

/**
 * The Well's balustrade: plinth, carved panels, posts with lotus caps, a top rail; the ground line is heavier.
 * It runs along z at x = `at` (or along x at z = `at` when `alongX`), from `a0` down to `a1`. `buds` false: the posts
 * keep their cap blocks only (the balustrade model's specimen: its lotus buds are the finial model's)
 */
export function balustrade(k: Kit, at: number, a0: number, a1: number, y: number, alongX = false, carved = false, lionRun?: 'plaza' | 'street', onBud?: (x: number, y: number, z: number, drawn: Box3) => void, buds = true): void {
  const len = a0 - a1;
  const n = Math.max(1, Math.round(len / 2.3));
  const step = len / n;
  const bx = (p: number, yy: number, sAcross: number, sy: number, sAlong: number, lk: Look): void => {
    if (alongX) k.box(p, yy, at, sAlong, sy, sAcross, lk);
    else k.box(at, yy, p, sAcross, sy, sAlong, lk);
  };
  const px = (p: number): [number, number] => (alongX ? [p, at] : [at, p]);
  bx((a0 + a1) / 2, y, 0.62, 0.16, len, { ...STONE, line: 2 });
  for (let i = 0; i <= n; i++) {
    const p = a0 - i * step;
    const [cx, cz] = px(p);
    // E281: chunkier posts under a square cap slab (the A1 / A2 targets' balustrade), the cap's top at +1.12 (a lion's seat)
    bx(p, y + 0.16, 0.44, 0.86, 0.44, STONE);
    bx(p, y + 1.02, 0.54, 0.1, 0.54, STONE);
    // a lotus-bud finial (style-A's balustrade): a petal collar, the bud swelling and closing to a point; a post that
    // carries a TRELLIS lion (props3d.ts) keeps only its cap block
    // (each bud is a copy of the lotus finial model, models/lotusFinial.ts: `onBud` records where it stands)
    if (buds && (lionRun === undefined || !lionOnPost(lionRun, i, n))) {
      const v0 = k.vertexCount;
      lotusBud(k, cx, y + 1.12, cz);
      onBud?.(cx, y + 1.12, cz, k.boundsFrom(v0, new Box3()));
    }
    if (i < n) {
      const pm = p - step / 2;
      // (E281 round 2: the panel wall 24 cm thick under a 34 cm rail, as the targets' heavy carved balustrade; the
      // colliders' span, x −0.1 … 0.5, still holds it)
      bx(pm, y + 0.16, 0.24, PANEL_H, step - 0.44, { wash: 0x55575d, kind: K.panel, line: 1, wet: 0.5 });
      // both faces carved: the instanced panel (carvedPanel), scaled to this gap
      if (carved) {
        const [pcx, pcz] = px(pm);
        for (const side of [1, -1]) {
          const nrm = alongX ? new Vector3(0, 0, side) : new Vector3(side, 0, 0);
          const m = new Matrix4().compose(new Vector3(pcx + nrm.x * 0.12, y + 0.16, pcz + nrm.z * 0.12),
            new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), nrm), new Vector3((step - 0.44) / PANEL_W, 1, 1));
          placeSet('balustrade-panel', carvedPanel, m);
        }
      }
      bx(pm, y + 0.76, 0.34, 0.12, step - 0.3, STONE);
    }
  }
}

/**
 * A lotus-bud finial on a post's cap at (cx, yb, cz): a petal collar turned out over the cap, a neck, then the bud
 * swelling and closing to a point — one ruled lathe of eight faces, its ribs the petals' seams (E281: the targets'
 * buds are as wide as the post, ~0.55 m, and ~0.7 m tall, carved stone with petal lines; a smooth brushed bud read as
 * an egg). ~290 vertices where the old 12-sided lathe took 336.
 */
export function lotusBud(k: Kit, cx: number, yb: number, cz: number): void {
  k.lathe(cx, yb, cz, [[0.25, 0], [0.29, 0.05], [0.27, 0.1], [0.2, 0.13], [0.25, 0.22], [0.265, 0.32], [0.225, 0.44], [0.15, 0.55], [0.06, 0.64], [0, 0.69]], 8, BUD, true, 3);
}

/**
 * A mahjong table for the TRELLIS sitters (they bring their own stools): the hero lab's table (hero/figures.ts) at a
 * quarter of its vertices — each wall of tiles and each standing hand one ruled block instead of 9 and 7 little boxes,
 * no hidden undersides (E281: ~490 vertices a table where it took ~1 950; the same random draws, so nothing after it
 * moves). From the spawn the nearest table is 8 m off: a tile is a pixel there.
 */
export function mahjongTable(k: Kit, rng: Rng, px: number, py: number, pz: number, r: number): void {
  const c = Math.cos(r), sn = Math.sin(r);
  const at = (lx: number, lz: number, a: number): [number, number] => {
    const ca = Math.cos(a), sa = Math.sin(a);
    return [px + lx * ca + lz * sa, pz - lx * sa + lz * ca];
  };
  k.box(px, py + 0.7, pz, 0.98, 0.07, 0.98, { wash: 0x5a3a26, line: 1, accent: true }, { rotY: r, top: { wash: 0x2f6a4c, line: 1, accent: true }, bottom: null });
  for (const [lx, lz] of [[-0.42, -0.42], [0.42, -0.42], [0.42, 0.42], [-0.42, 0.42]] as const) {
    k.box(px + lx * c + lz * sn, py, pz - lx * sn + lz * c, 0.06, 0.7, 0.06, { wash: 0x3d2a1e, line: 0.6 }, { rotY: r, top: null, bottom: null });
  }
  const tile: Look = { wash: 0xefe8d6, line: 0.6, accent: true };
  for (let side = 0; side < 4; side++) {
    const a = r + (side * Math.PI) / 2;
    const [wx, wz] = at(0, 0.3, a);
    k.box(wx, py + 0.77, wz, 0.62, 0.05, 0.042, { ...tile, kind: K.panel }, { rotY: a, bottom: null });
    const [hx, hz] = at(0, 0.4, a);
    k.box(hx, py + 0.77, hz, 0.46, 0.075, 0.035, tile, { rotY: a, bottom: null });
    for (let i = 0; i < 3; i++) {
      const [dx, dz] = at(rng.range(-0.18, 0.18), rng.range(-0.1, 0.18), a);
      k.box(dx, py + 0.77, dz, 0.06, 0.02, 0.08, tile, { rotY: a + rng.range(-0.4, 0.4), bottom: null });
    }
  }
}
