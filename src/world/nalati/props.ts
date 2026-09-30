/**
 * The Nalati props' shared look (B5): the camp palette (`PC`), the weathered timber grain the fences, racks and rails are
 * painted with (`GRAIN` / `WOOD`), the syrmak felt-rug painter, and the split-rail fence run. The camps' props are
 * models now (E306 / E315: src/chunks/nalati-grasslands/models/campProps.ts, campGenerated.ts, yurt.ts).
 */
import * as THREE from 'three';
import { type PaintKit, type PaintOpts, v3, woodPainter, woodPole } from './paint';
import { TEX_MEAN } from '../nalatiTextures';
import type { Collider } from '../../player/Player';

export const PC = {
  wood: new THREE.Color('#8b5e36'),
  woodLight: new THREE.Color('#a8784a'),
  woodDark: new THREE.Color('#553821'),
  woodGrey: new THREE.Color('#8c7457'), // weathered larch (E302: the old #8a7d6c went purple in the violet shade)
  iron: new THREE.Color('#34312f'),
  red: new THREE.Color('#b1301d'),
  redDark: new THREE.Color('#5a1d13'),
  orange: new THREE.Color('#d8782c'),
  gold: new THREE.Color('#dca744'),
  cream: new THREE.Color('#f1e3c2'),
  blue: new THREE.Color('#2f4f86'),
  teal: new THREE.Color('#2f7d7a'),
  leather: new THREE.Color('#6a4024'),
  stone: new THREE.Color('#8f8c86'),
  stoneDark: new THREE.Color('#6c6a66'),
  hay: new THREE.Color('#cfae5c'),
};

type Ground = (x: number, z: number) => number;

/**
 * The weathered timber of the fences, racks and rails (E302, NALATI-FINISH B9: they read as untextured purple-grey
 * boxes): the kit's 'rock' textured layer — the painted granite the terrain already has on the GPU, so no new texture —
 * laid as grain along each pole (paint.ts woodPole), × the painted wood colour over the tile's mean (paint.ts woodPainter).
 * Every builder that paints timber with it finishes the layer: `kit.texturedMesh(sky, 'rock', …)`.
 */
const ROCK_MEAN = TEX_MEAN.rock;
export const GRAIN = woodPainter(PC.woodGrey, '#b3a792', new THREE.Color(1 / ROCK_MEAN[0], 1 / ROCK_MEAN[1], 1 / ROCK_MEAN[2]));
export const WOOD: PaintOpts = { uv: true, tex: 'rock', brush: 0.1 };

// ── felt rugs ────────────────────────────────────────────────────────────────────────────────────────

const RUG_PALETTES: { field: THREE.Color; band: THREE.Color; edge: THREE.Color; motif: THREE.Color }[] = [
  { field: PC.red, band: PC.cream, edge: PC.redDark, motif: PC.gold },
  { field: PC.blue, band: PC.orange, edge: PC.redDark, motif: PC.cream },
  { field: PC.orange, band: PC.redDark, edge: PC.redDark, motif: PC.cream },
  { field: PC.teal, band: PC.cream, edge: PC.redDark, motif: PC.red },
];

/** a syrmak felt rug w × h (local x across, local y along, in the XY plane, 2 cm thick) — painted per face */
export function rugGeometry(w: number, h: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, 0.02, Math.round(w * 8), Math.round(h * 8), 1);
}
export function rugPainter(w: number, h: number, pal: number): (p: THREE.Vector3) => THREE.Color {
  const P = RUG_PALETTES[pal % RUG_PALETTES.length] ?? { field: PC.red, band: PC.cream, edge: PC.redDark, motif: PC.gold };
  return (p) => {
    const bu = w / 2 - Math.abs(p.x), bv = h / 2 - Math.abs(p.y), b = Math.min(bu, bv);      // metres in from the edge
    if (b < 0.05) return P.edge;
    if (b < 0.2) {
      // zig-zag band: the running-hook along the border
      const along = bu < bv ? p.y : p.x;
      const zz = Math.abs(((along * 6) % 2 + 2) % 2 - 1);                                     // 0..1 triangle wave
      return (b - 0.05) / 0.15 < zz * 0.8 + 0.1 ? P.band : P.field;
    }
    if (b < 0.25) return P.edge;
    // field: a stepped diamond medallion with ram-horn hooks, repeated along the long axis
    const cell = Math.min(w, h) - 0.5;
    const yy = ((p.y / cell) % 1 + 1.5) % 1 - 0.5, xx = p.x / cell;
    const d = Math.abs(xx) + Math.abs(yy);
    if (d < 0.1) return P.band;
    if (d < 0.22) return P.motif;
    if (d > 0.3 && d < 0.36 && Math.abs(xx) > 0.08 && Math.abs(yy) > 0.08) return P.motif;
    return P.field;
  };
}

// ── fences ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * A split-rail fence along a polyline (posts every ~2.4 m, two rails, the rails sag slightly). One collider per
 * straight segment. Posts follow the ground.
 */
export function addFence(kit: PaintKit, ground: Ground, pts: [number, number][], colliders: Collider[], o: { h?: number; spacing?: number } = {}): void {
  const h = o.h ?? 1.15, sp = o.spacing ?? 2.4, rng = kit.rng;
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i], q = pts[i + 1];
    if (!p || !q) continue;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.round(len / sp));
    const posts: THREE.Vector3[] = [];
    for (let k = 0; k <= n; k++) {
      if (k === 0 && i > 0) { const last = posts[posts.length - 1]; if (last) posts.push(last); continue; }
      const t = k / n, x = p[0] + (q[0] - p[0]) * t + rng.range(-0.05, 0.05), z = p[1] + (q[1] - p[1]) * t + rng.range(-0.05, 0.05);
      const y = ground(x, z);
      const lean = rng.range(-0.05, 0.05);
      kit.add(woodPole(v3(x, y - 0.3, z), v3(x + lean, y + h + rng.range(-0.05, 0.08), z + lean * 0.5), 0.075, 0.06, 7, 3), GRAIN, { ...WOOD, jitter: 0.1, foot: 0.7, brush: 0.14 });
      posts.push(v3(x, y, z));
    }
    for (let k = 0; k + 1 < posts.length; k++) {
      const a = posts[k], b = posts[k + 1];
      if (!a || !b) continue;
      for (const ry of [h * 0.45, h * 0.88]) {
        const mid = v3((a.x + b.x) / 2, (a.y + b.y) / 2 + ry - 0.05, (a.z + b.z) / 2);
        kit.add(woodPole(v3(a.x, a.y + ry, a.z), mid, 0.05, 0.05, 6, 2), GRAIN, { ...WOOD, jitter: 0.1, brush: 0.14 });
        kit.add(woodPole(mid, v3(b.x, b.y + ry, b.z), 0.05, 0.05, 6, 2), GRAIN, { ...WOOD, jitter: 0.1, brush: 0.14 });
      }
    }
    const cx = (p[0] + q[0]) / 2, cz = (p[1] + q[1]) / 2, yaw = Math.atan2(q[0] - p[0], q[1] - p[1]);
    const gy = ground(cx, cz);
    colliders.push({ x: cx, z: cz, hw: 0.12, hd: len / 2, rot: -yaw, yBottom: gy - 1.5, yTop: gy + h });
  }
}

