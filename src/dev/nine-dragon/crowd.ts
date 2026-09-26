// Dome B (E169, round-10-dome-b): crowd variety. The TRELLIS walker (public/assets/nine-dragon/lab/walker.glb, 2.08 m
// to the umbrella's crown) comes in two ramps (dark coats, beige jackets), every umbrella a dark one; the dome-B
// targets' crowd carries mostly dark umbrellas with a few red and ochre oil-paper ones. `tintUmbrella` recolours the
// umbrella (every vertex above `above` metres, the canopy over the head) of a walker geometry, keeping its shading
// (the baked AO and the ramp step survive as a relative value), and returns a new geometry: one more instanced draw.
import { type BufferGeometry, Color, Float32BufferAttribute } from 'three';

export function tintUmbrella(src: BufferGeometry, color: number, above = 1.8): BufferGeometry {
  const g = src.clone();
  const pos = g.getAttribute('position'), col = g.getAttribute('color');
  const tint = new Color(color);
  let lmax = 1e-4;
  for (let i = 0; i < col.count; i++) if (pos.getY(i) > above) lmax = Math.max(lmax, 0.2126 * col.getX(i) + 0.7152 * col.getY(i) + 0.0722 * col.getZ(i));
  const out = new Float32Array(col.count * 3);
  for (let i = 0; i < col.count; i++) {
    const r = col.getX(i), gg = col.getY(i), b = col.getZ(i);
    if (pos.getY(i) > above) {
      const k = 0.7 + 0.45 * ((0.2126 * r + 0.7152 * gg + 0.0722 * b) / lmax);
      out[i * 3] = tint.r * k;
      out[i * 3 + 1] = tint.g * k;
      out[i * 3 + 2] = tint.b * k;
    } else {
      out[i * 3] = r;
      out[i * 3 + 1] = gg;
      out[i * 3 + 2] = b;
    }
  }
  g.setAttribute('color', new Float32BufferAttribute(out, 3));
  return g;
}
