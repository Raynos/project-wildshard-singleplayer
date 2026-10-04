/**
 * bearFix — E322 F-M2: Pine Hollow's bears, fixed (Jake picked B; the unfixed bears and their Debug row are gone).
 *
 * 1. The stub-tail flap. Both bear hulls (Hunyuan3D-2, art/pine-hollow/round-9-creature-refs/) came back with a ~25 cm lobe
 *    of fur hanging off the top of the rump like a dog's tail: the generator's, not a bear's. It is not a separate part —
 *    the flap IS the upper rump's surface pulled back and down (deleting its triangles leaves a hole), so it is
 *    collapsed, not cut: every vertex above `yMin` behind the rump's back plane is pressed onto that plane, keeping `keep`
 *    of its depth (the flap's outer surface stays outermost, so the pressed layers never fight). Topology, uvs, skin
 *    indices and weights are untouched — only positions move, and the moved vertices' normals are re-derived from their
 *    faces. The same numbers serve both tiers (the phone hull is the desktop one simplified, in the same space). The pressed
 *    patch still wears the flap's paler texels: pineCoats.ts (`CoatRig.flap`) gives them the rump's colour.
 *
 *    The plane per hull is read off a slice profile of the rig's mesh (per height band, the rearmost z of the rump
 *    below the flap, y < 0.47, and where the flap roots at the top of the rump): art/pine-hollow/round-19-e322-bears-birds/.
 *
 * 2. The coats (pineCoats.ts `CoatSpec.measured`): unfixed, the brown hull wore its own atlas unchanged (it IS the 'brown'
 *    source) and in Pine Hollow's light — the fur material's warm sheen and backlit rim over a pale tan — it read pinkish;
 *    the Grizzled Sow was that atlas pushed paler still under a near-white rim, and read near-white. Now the hull's own
 *    three tones are MEASURED off its atlas and mapped exactly onto real brown-bear tones (BEAR_FIX_COATS: a grizzly's
 *    deep brown legs, mid-brown body, blond guard-hair tips; the Sow a darker brown with silver tips painted over her hump,
 *    shoulders and back, her legs darker), and the sheen and rim take the coat's own hue (BEAR_FIX_FUR) instead of a pale
 *    pink-white.
 */
import type { RGB } from '@wildshard/engine/entities/species/loft';

/** one hull's flap: the rump's back plane z(y) = z0 + (y - y0) · slope, pressed above yMin; `bulge` (m) rounds the
 *  pressed patch out into a dome (0 at its rim), so it reads as the rump's curve, not a flat plate */
export interface TailTrim { yMin: number; y0: number; z0: number; slope: number; keep: number; bulge: number }

export const BEAR_TAIL_TRIM: Readonly<Record<'bear-black' | 'bear-brown', TailTrim>> = {
  'bear-brown': { yMin: 0.46, y0: 0.47, z0: -0.5, slope: -0.08, keep: 0.08, bulge: 0.05 },
  'bear-black': { yMin: 0.46, y0: 0.47, z0: -0.025, slope: 0.08, keep: 0.08, bulge: 0.035 },
};

/**
 * Collapse the flap in place (see the header). Returns the pressed vertices (1 = moved), or null when none moved.
 */
export function trimTail(pos: Float32Array, nrm: Float32Array, index: ArrayLike<number>, t: TailTrim): Uint8Array | null {
  const n = pos.length / 3;
  const moved = new Uint8Array(n);
  const plane = (y: number): number => t.z0 + (y - t.y0) * t.slope;
  let count = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3] ?? 0, y = pos[i * 3 + 1] ?? 0, z = pos[i * 3 + 2] ?? 0;
    if (y < t.yMin || z >= plane(y)) continue;
    moved[i] = 1;
    count++;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (count === 0) return null;
  // the patch's ellipse (its x / y extent): the dome is `bulge` at the centre, 0 at the rim
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hx = Math.max(0.02, (x1 - x0) / 2), hy = Math.max(0.02, (y1 - y0) / 2);
  for (let i = 0; i < n; i++) {
    if (moved[i] !== 1) continue;
    const x = pos[i * 3] ?? 0, y = pos[i * 3 + 1] ?? 0, z = pos[i * 3 + 2] ?? 0, zp = plane(y);
    const r2 = ((x - cx) / hx) ** 2 + ((y - cy) / hy) ** 2;
    pos[i * 3 + 2] = zp - (zp - z) * t.keep - t.bulge * Math.max(0, 1 - r2);
  }
  // welded ids (positions to 0.1 mm), so a seam's split vertices share one normal
  const ids = weldIds(pos);
  let nWeld = 0;
  for (let i = 0; i < n; i++) nWeld = Math.max(nWeld, (ids[i] ?? 0) + 1);
  const hit = new Uint8Array(nWeld);
  for (let i = 0; i < n; i++) if (moved[i] === 1) hit[ids[i] ?? 0] = 1;
  const acc = new Float64Array(nWeld * 3);
  for (let f = 0; f + 2 < index.length; f += 3) {
    const a = index[f] ?? 0, b = index[f + 1] ?? 0, c = index[f + 2] ?? 0;
    if (hit[ids[a] ?? 0] !== 1 && hit[ids[b] ?? 0] !== 1 && hit[ids[c] ?? 0] !== 1) continue;
    const ax = pos[a * 3] ?? 0, ay = pos[a * 3 + 1] ?? 0, az = pos[a * 3 + 2] ?? 0;
    const ux = (pos[b * 3] ?? 0) - ax, uy = (pos[b * 3 + 1] ?? 0) - ay, uz = (pos[b * 3 + 2] ?? 0) - az;
    const vx = (pos[c * 3] ?? 0) - ax, vy = (pos[c * 3 + 1] ?? 0) - ay, vz = (pos[c * 3 + 2] ?? 0) - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;   // area-weighted
    for (const v of [a, b, c]) { const o = (ids[v] ?? 0) * 3; acc[o] = (acc[o] ?? 0) + nx; acc[o + 1] = (acc[o + 1] ?? 0) + ny; acc[o + 2] = (acc[o + 2] ?? 0) + nz; }
  }
  for (let i = 0; i < n; i++) {
    const id = ids[i] ?? 0;
    if (hit[id] !== 1) continue;
    const x = acc[id * 3] ?? 0, y = acc[id * 3 + 1] ?? 0, z = acc[id * 3 + 2] ?? 0, l = Math.hypot(x, y, z);
    if (l < 1e-12) continue;
    nrm[i * 3] = x / l; nrm[i * 3 + 1] = y / l; nrm[i * 3 + 2] = z / l;
  }
  return moved;
}

/** per vertex, an id shared by every vertex at the same position (to 0.1 mm): the uv seams' split copies weld */
export function weldIds(pos: ArrayLike<number>): Int32Array {
  const n = Math.floor(pos.length / 3), ids = new Int32Array(n), weld = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round((pos[i * 3] ?? 0) * 1e4)},${Math.round((pos[i * 3 + 1] ?? 0) * 1e4)},${Math.round((pos[i * 3 + 2] ?? 0) * 1e4)}`;
    let id = weld.get(k);
    if (id === undefined) { id = weld.size; weld.set(k, id); }
    ids[i] = id;
  }
  return ids;
}

/**
 * The fixed bears' coats: per variant, the brown hull's [dark, base, tip] keys (sRGB albedo). A variant not here keeps
 * its hull's own tones. Brown: a grizzly's deep brown legs and belly, mid-brown body, blond guard-hair tips (hue ~25–35°,
 * saturation ~0.5–0.6 — where the pink tan measured at hue 13–22° sat). Grizzled Sow: the same bear old and
 * silver-tipped — a darker brown body and legs, `grizzle`: silver tips over the hump and back (pineCoats.ts), never white.
 */
export const BEAR_FIX_COATS: Readonly<Record<string, Readonly<Record<string, RGB>>>> = {
  brown: { dark: [0.17, 0.115, 0.08], base: [0.40, 0.28, 0.185], tip: [0.64, 0.51, 0.37] },
  'brown-old': { dark: [0.14, 0.10, 0.07], base: [0.34, 0.25, 0.17], tip: [0.58, 0.50, 0.40], grizzle: [0.70, 0.67, 0.61] },
};

/** the fixed bears' sheen and backlit rim (FurStyle), in the coat's own hue */
export const BEAR_FIX_FUR: Readonly<Record<string, { rim: RGB; sheenColor: RGB }>> = {
  brown: { rim: [0.8, 0.6, 0.36], sheenColor: [0.3, 0.22, 0.13] },
  'brown-old': { rim: [0.78, 0.7, 0.58], sheenColor: [0.34, 0.3, 0.25] },
};
