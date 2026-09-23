/**
 * Look v2 — the three zones of world layout v2 (docs/design/nalati/layout-v2.md) as terrain-shading weights:
 * the lush green Kunes valley, the golden Sky Grassland bowl, the grey-white-blue snow ring (scree, snowfields).
 *
 * The layout owner exports `zoneAt(x, z)` from src/chunks/nalati-grasslands.ts (valley / bowl / snow-ring weights);
 * until it lands — and for any shape it takes (an object with valley / bowl / snow | snowRing | ring keys, or a
 * [valley, bowl, snow] tuple) — this reads it dynamically and falls back to the height bands of the current land
 * (valley below +5 m, bowl / plateau +18 … +48, the snow ring above +50 or on the steep rock above +35).
 * Terrain.ts bakes the weights into a per-vertex `zone` attribute; terrainSurface.ts grades the ground by it in v2.
 */
import * as nalatiDef from '../../chunks/nalati-grasslands';

const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function fromExport(x: number, z: number, out: [number, number, number]): boolean {
  const fn: unknown = Reflect.get(nalatiDef, 'zoneAt');
  if (typeof fn !== 'function') return false;
  const r: unknown = Reflect.apply(fn, undefined, [x, z]);
  if (Array.isArray(r)) { out[0] = num(r[0]); out[1] = num(r[1]); out[2] = num(r[2]); return true; }
  if (typeof r === 'object' && r !== null) {
    out[0] = num(Reflect.get(r, 'valley'));
    out[1] = num(Reflect.get(r, 'bowl'));
    out[2] = num(Reflect.get(r, 'snow')) || num(Reflect.get(r, 'snowRing')) || num(Reflect.get(r, 'ring'));
    return true;
  }
  return false;
}

/** zone weights at (x, z) with ground height `h` and slope `slope` (1 − n.y): [valley, bowl, snow ring], summing to ~1 */
export function zoneWeights(x: number, z: number, h: number, slope: number, out: [number, number, number]): [number, number, number] {
  if (!fromExport(x, z, out)) {
    const snow = Math.max(smooth(44, 56, h), smooth(30, 42, h) * smooth(0.18, 0.32, slope));
    const valley = (1 - smooth(0, 12, h)) * (1 - snow);
    out[0] = valley; out[1] = Math.max(0, 1 - valley - snow); out[2] = snow;
  }
  const s = out[0] + out[1] + out[2];
  if (s > 1e-4) { out[0] /= s; out[1] /= s; out[2] /= s; } else { out[0] = 1; out[1] = 0; out[2] = 0; }
  return out;
}
