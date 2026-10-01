/**
 * The Nalati props' shared look (B5): the camp palette (`PC`), the weathered timber grain the fences, racks and rails are
 * painted with (`GRAIN` / `WOOD`) and the syrmak felt-rug painter. The camps' props and the fences are models now
 * (E306 / E315: src/shards/nalati-grasslands/models/campProps.ts, campGenerated.ts, yurt.ts, fence.ts).
 */
import * as THREE from 'three';
import { type PaintOpts, woodPainter } from './paint';
import { TEX_MEAN } from '../look/nalatiTextures';

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
