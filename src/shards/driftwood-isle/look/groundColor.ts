/**
 * Driftwood's ground palette (E357 S4.3 step 3, moved verbatim from Terrain.ts): the faceted terrain's colour by height
 * above the sea and slope. Node-safe (three only): the terrain painter, the ground cover's placement and the Blender
 * export (scripts/blender/driftwood-isle/export.mjs) read the same function.
 */
import * as THREE from 'three';

// ── low-poly palette (sRGB in, linear out via THREE.Color) ──
export const LP = {
  seabed: new THREE.Color('#15a0b4'),   // the lagoon floor as seen through the water (Beer–Lambert's green-cyan baked in: the sea over it is clear)
  wetSand: new THREE.Color('#caa66c'),   // the swash tint: a shade darker than the dry sand, not mud
  sand: new THREE.Color('#ffd98c'),   // warm golden (E43 round 6: matched to the mockups by palette-delta.py)
  grass: new THREE.Color('#6cae47'),
  grassDark: new THREE.Color('#4d8c33'),
  grassHigh: new THREE.Color('#9acb52'),
  rock: new THREE.Color('#666a70'),
  rockLight: new THREE.Color('#84888e'),
  path: new THREE.Color('#d6bd84'),
};
const _tmpC = new THREE.Color();
const ss = THREE.MathUtils.smoothstep;
export const hash2 = (x: number, z: number): number => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };

/**
 * One facet's colour from its height above the sea (m), slope (0 flat → 1 vertical) and position (jitter). `lip` (0..1)
 * marks a steep facet at the top edge of a cliff: it keeps the grass (the mockups' grass-topped cliff lips, L6).
 */
export function lowPolyGroundColor(out: THREE.Color, h: number, slope: number, x: number, z: number, lip = 0): THREE.Color {
  if (h < 0) out.lerpColors(LP.seabed, LP.wetSand, ss(h, -1.6, 0));
  else out.lerpColors(LP.wetSand, LP.sand, ss(h, 0.25, 0.55));                 // a distinct dark wet band along the swash line
  // grass takes over above the beach, darker in the folds, sun-bleached lighter as the ground climbs
  const g = ss(h, 2.9, 3.5);                                                  // a hard sand → grass line
  if (g > 0) {
    _tmpC.lerpColors(LP.grass, LP.grassDark, hash2(Math.floor(x * 0.11), Math.floor(z * 0.11)) * 0.6);
    _tmpC.lerp(LP.grassHigh, ss(h, 6, 24) * 0.7);
    out.lerp(_tmpC, g);
  }
  // rock on the steep facets (a hair lighter on the flatter ledges, faint strata bands) — except a grass lip on the rim
  const r = ss(slope, 0.3, 0.36) * (1 - lip * ss(h, 2.5, 4.5));              // a hard grass → rock line: crisp faceted crags
  if (r > 0) {
    _tmpC.lerpColors(LP.rock, LP.rockLight, 1 - ss(slope, 0.45, 0.8)).multiplyScalar(0.92 + 0.1 * Math.sin(h * 1.4 + hash2(Math.floor(x * 0.05), 0) * 2));
    out.lerp(_tmpC, r);
  }
  // per-facet jitter so the flat shading reads as facets, not a gradient
  return out.multiplyScalar(0.93 + hash2(x, z) * 0.14);
}
