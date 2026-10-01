import { mixRGB, seeded, type Facets, type RGB, type V3 } from './facets';

export const GRASS: RGB = [0.27, 0.4, 0.13];
const GRASS_SUN: RGB = [0.45, 0.52, 0.17];
const LIP: RGB = [0.2, 0.27, 0.1];
const ROCK_TOP: RGB = [0.42, 0.3, 0.24];
const ROCK_LOW: RGB = [0.2, 0.15, 0.15];

export interface IslandShape { rim: [number, number][]; top: number; cx: number; cz: number }

/**
 * One floating island into `f`: a flat grass top on a jittered polygon rim, a mossy lip, then a faceted rock cone that
 * narrows to a tip `depth` below, hung with a few stalactites. Returns the rim (world xz) the collider is built from.
 */
export function island(f: Facets, cx: number, cz: number, top: number, r: number, depth: number, seed: number, sides = 14): IslandShape {
  const random = seeded(seed), rim: [number, number][] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2, k = 1 + (random() - 0.5) * 0.12;
    rim.push([cx + Math.sin(a) * r * k, cz + Math.cos(a) * r * k]);
  }
  const at = (i: number): [number, number] => rim[((i % sides) + sides) % sides] ?? [cx, cz];
  // the walkable top: an inner ring a touch lower than the rim reads as a gentle crown without leaving the collider
  const inner: V3[] = rim.map(([x, z]) => [cx + (x - cx) * 0.55, top + 0.05 + random() * 0.1, cz + (z - cz) * 0.55]);
  const centre: V3 = [cx, top + 0.12, cz];
  for (let i = 0; i < sides; i++) {
    const [ax, az] = at(i), [bx, bz] = at(i + 1), ia = inner[i] ?? centre, ib = inner[(i + 1) % sides] ?? centre;
    const lit = Math.max(0, Math.sin((i / sides) * Math.PI * 2 + 2.2));
    f.tri(centre, ia, ib, mixRGB(GRASS, GRASS_SUN, lit * 0.6));
    f.quad(ia, [ax, top, az], [bx, top, bz], ib, mixRGB(GRASS, GRASS_SUN, lit));
  }
  // the lip and the rock cone: rings that step out a little, then in to the tip
  const rings: { k: number; y: number; c: RGB }[] = [{ k: 1, y: top, c: LIP }, { k: 1.04, y: top - 0.9, c: LIP }, { k: 0.92, y: top - 2.4, c: ROCK_TOP }];
  const steps = 4;
  for (let s = 1; s <= steps; s++) { const t = s / steps; rings.push({ k: 0.92 * (1 - t * 0.82) + (random() - 0.5) * 0.05, y: top - 2.4 - depth * t * (0.85 + random() * 0.15), c: mixRGB(ROCK_TOP, ROCK_LOW, t) }); }
  const ringPts = rings.map(({ k, y }, n) => rim.map(([x, z], i): V3 => {
    const wob = n < 2 ? 0 : (random() - 0.5) * 0.18 * r * (n / rings.length);
    return [cx + (x - cx) * k + wob, y + (n < 2 ? 0 : (random() - 0.5) * 1.2), cz + (z - cz) * k + ((i * 7919) % 3 - 1) * wob * 0.5];
  }));
  for (let n = 0; n + 1 < ringPts.length; n++) {
    const up = ringPts[n] ?? [], down = ringPts[n + 1] ?? [], c = rings[n + 1]?.c ?? ROCK_LOW;
    for (let i = 0; i < sides; i++) {
      const a = up[i], b = up[(i + 1) % sides], d = down[i], e = down[(i + 1) % sides];
      if (a && b && d && e) f.quad(a, d, e, b, c);
    }
  }
  const last = ringPts[ringPts.length - 1] ?? [], tip: V3 = [cx + (random() - 0.5) * r * 0.2, top - depth * 1.08, cz + (random() - 0.5) * r * 0.2];
  for (let i = 0; i < sides; i++) { const a = last[i], b = last[(i + 1) % sides]; if (a && b) f.tri(a, tip, b, ROCK_LOW); }
  // stalactites hanging from the underside
  const spikes = 3 + Math.floor(random() * 4);
  for (let s = 0; s < spikes; s++) {
    const ring = ringPts[2 + Math.floor(random() * 3)] ?? [], i = Math.floor(random() * sides), p = ring[i];
    if (!p) continue;
    const w = 0.5 + random() * 1.1, len = 3 + random() * depth * 0.5, x = p[0] + (cx - p[0]) * 0.1, z = p[2] + (cz - p[2]) * 0.1;
    const base: V3[] = [[x - w, p[1], z], [x, p[1], z + w], [x + w, p[1], z], [x, p[1], z - w]], end: V3 = [x, p[1] - len, z];
    for (let k = 0; k < 4; k++) { const a = base[k], b = base[(k + 1) % 4]; if (a && b) f.tri(a, end, b, ROCK_LOW); }
  }
  return { rim, top, cx, cz };
}

/** A faceted boulder (an irregular octahedron) sitting on y. */
export function boulder(f: Facets, x: number, y: number, z: number, s: number, seed: number): void {
  const random = seeded(seed), j = (): number => 0.75 + random() * 0.5;
  const top: V3 = [x, y + s * 1.2 * j(), z], bot: V3 = [x, y - s * 0.2, z];
  const ring: V3[] = [0, 1, 2, 3, 4].map((i): V3 => { const a = (i / 5) * Math.PI * 2 + random(); return [x + Math.sin(a) * s * j(), y + s * 0.45, z + Math.cos(a) * s * j()]; });
  for (let i = 0; i < 5; i++) { const a = ring[i], b = ring[(i + 1) % 5]; if (!a || !b) continue; f.tri(top, a, b, [0.5, 0.42, 0.38]); f.tri(bot, b, a, [0.3, 0.24, 0.22]); }
}

/** A low-poly grass tuft (two crossed blades). */
export function tuft(f: Facets, x: number, y: number, z: number, h: number, yaw: number): void {
  for (let k = 0; k < 2; k++) {
    const a = yaw + k * Math.PI / 2, dx = Math.sin(a) * 0.35, dz = Math.cos(a) * 0.35;
    f.tri([x - dx, y, z - dz], [x + dx, y, z + dz], [x + dx * 0.2, y + h, z + dz * 0.2], GRASS_SUN);
    f.tri([x + dx, y, z + dz], [x - dx, y, z - dz], [x + dx * 0.2, y + h, z + dz * 0.2], GRASS);
  }
}
