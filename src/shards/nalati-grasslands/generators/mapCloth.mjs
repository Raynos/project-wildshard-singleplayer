// Flutter's t=0 rest surface, derived from the recorded cloth calls. Smoke is
// depth-off and has no height-pass footprint, just as in the browser map bake.
import { BufferGeometry, Color, Float32BufferAttribute } from 'three';

export function mapCloth(effects, wind) {
  const positions = [], colours = [], indices = [];
  let count = 0;
  for (const [kind, [ax, ay, az], a, b, colour, options = {}] of effects) {
    if (kind === 'emitter') continue;
    if (!['streamer', 'flag', 'strip'].includes(kind)) throw new Error(`Unknown map effect ${kind}`);
    const flag = kind === 'flag', strip = kind === 'strip', len = flag ? b : a, width = flag ? 0 : b;
    const droop = strip ? .8 : options.droop ?? (flag ? .25 : .45), taper = strip ? .2 : options.taper ?? (flag ? 0 : .35);
    const phase = (ax * 1.7 + az * 2.3 + count++ * .61) % (Math.PI * 2), seg = Math.max(2, Math.min(14, Math.round(len * 5)));
    const W = { x: wind[0], z: wind[1], s: Math.min(1.2, wind[2] * .7) };
    const sx = flag ? 0 : -W.z * width, sy = flag ? -a : 0, sz = flag ? 0 : W.x * width;
    const drop = Math.min(.97, droop * (1.25 - W.s * .75) + .08 * Math.sin(phase));
    const gust = .85 + .15 * Math.sin(phase * 1.3) * Math.sin(phase);
    let dx = W.x * (1 - drop), dy = -drop, dz = W.z * (1 - drop);
    const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
    let nx = dy * sz - dz * sy, ny = dz * sx - dx * sz, nz = dx * sy - dy * sx;
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const amp = (.06 + .16 * W.s) * gust, k = 7.5 / Math.max(.4, len), c = new Color(colour), start = positions.length / 3;
    for (let i = 0; i <= seg; i++) {
      const u = i / seg, along = u * len, wave = Math.sin(k * along + phase) * amp * u * len * .35;
      const sag = -u * u * len * .18 * (1 - W.s * .6), sw = 1 - taper * u;
      const cx = ax + dx * along + nx * wave, cy = ay + dy * along + ny * wave + sag, cz = az + dz * along + nz * wave;
      const twist = Math.sin(k * .6 * along + phase) * .25 * u, span = Math.hypot(sx, sy, sz);
      for (let j = 0; j < 2; j++) {
        positions.push(cx + (sx + nx * twist * span) * j * sw, cy + sy * j * sw, cz + (sz + nz * twist * span) * j * sw);
        const shade = .92 + .08 * (1 - i / (seg + 1)); colours.push(c.r * shade, c.g * shade, c.b * shade);
      }
      if (i < seg) { const p = start + i * 2; indices.push(p, p + 2, p + 1, p + 1, p + 2, p + 3); }
    }
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colours, 3)); geometry.setIndex(indices);
  return geometry;
}
