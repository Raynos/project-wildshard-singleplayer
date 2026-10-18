/** The shipping painter uses these height/slope bands; the manifest exports no zone override. */
import { smoothstep } from '@wildshard/engine/core/noise';

/** zone weights at (x, z) with ground height `h` and slope `slope` (1 − n.y): [valley, bowl, snow ring], summing to ~1 */
export function zoneWeights(_x: number, _z: number, h: number, slope: number, out: [number, number, number]): [number, number, number] {
  {
    const snow = Math.max(smoothstep(44, 56, h), smoothstep(30, 42, h) * smoothstep(0.18, 0.32, slope));
    const valley = (1 - smoothstep(0, 12, h)) * (1 - snow);
    out[0] = valley; out[1] = Math.max(0, 1 - valley - snow); out[2] = snow;
  }
  const s = out[0] + out[1] + out[2];
  if (s > 1e-4) { out[0] /= s; out[1] /= s; out[2] /= s; } else { out[0] = 1; out[1] = 0; out[2] = 0; }
  return out;
}
