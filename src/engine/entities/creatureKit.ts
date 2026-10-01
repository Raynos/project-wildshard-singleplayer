import * as THREE from 'three';
import { loft, type Paint, type Station } from './species/loft';

/**
 * Shape helpers for the Nalati creatures' painterly models (the look pass, docs/design/nalati/look-pass.md lever 7):
 * the silhouette detail a smooth loft cannot give — fur tufts (a wolf's ruff, cheek fluff, the brush), hair locks (a
 * horse's mane and tail strands). Everything is still a loft() part of the ONE skinned mesh, so it rides the bones
 * and costs no extra draw call.
 *
 *   tuft(root, dir, len, width, skin, part, paint, opts?)   a tapered, drooping, flattened spike of fur
 *   lock(points, width, thick, skins, part, paint)          a flat ribbon of hair through `points`, one skin per point
 */

export type V3 = [number, number, number];
/** skin of a station: [bone a, bone b, weight of b] */
export type Skin = [number, number, number];

const _d = new THREE.Vector3();

/**
 * A fur tuft: from `root` (sunk a little into the body) along `dir` for `len` m, drooping by `droop` × len toward −Y,
 * `width` wide at the root, flattened `flat` (0..1) across its sideways axis, tapering to a point. `skin` is the root's
 * skin, `tipSkin` (default the same) the tip's — a tip on a child bone lags / flows with it.
 */
export function tuft(root: V3, dir: V3, len: number, width: number, skin: Skin, part: string, paint: Paint,
  opts: { droop?: number; flat?: number; tipSkin?: Skin; sides?: number } = {}): THREE.BufferGeometry {
  const droop = opts.droop ?? 0.25, flat = opts.flat ?? 0.55, tip = opts.tipSkin ?? skin;
  _d.set(dir[0], dir[1], dir[2]).normalize();
  const pt = (u: number): V3 => [
    root[0] + _d.x * len * u,
    root[1] + _d.y * len * u - droop * len * u * u,
    root[2] + _d.z * len * u,
  ];
  const mixSkin = (u: number): Skin => (u < 0.5 ? skin : tip);
  const st: Station[] = [];
  const us = [0, 0.35, 0.7, 1];
  const rad = [width, width * 0.92, width * 0.58, width * 0.06];   // full, then a flame-like point
  for (let i = 0; i < us.length; i++) {
    const u = us[i] ?? 0, p = pt(u), r = rad[i] ?? 0, s = mixSkin(u);
    st.push({ x: p[0], y: p[1], z: p[2], rx: r, ry: r * (1 - flat), top: 1, bot: 1, b0: s[0], b1: s[1], w1: s[2] });
  }
  // a sideways tuft needs the 'z' ring frame (the 'x' frame degenerates when the tuft runs along X)
  const frame = Math.abs(_d.x) > 0.7 ? 'z' : 'x';
  return loft(st, opts.sides ?? 5, part, paint, false, true, frame);
}

/** A flat ribbon of hair through `points` (a mane lock, a tail strand): `width` wide, `thick` thick, tapering to the tip. */
export function lock(points: V3[], width: number, thick: number, skins: Skin[], part: string, paint: Paint, frame: 'x' | 'z' = 'x', sides = 6): THREE.BufferGeometry {
  const n = points.length;
  const st: Station[] = points.map((p, i) => {
    const u = n > 1 ? i / (n - 1) : 0;
    const s = skins[Math.min(i, skins.length - 1)] ?? [0, 0, 0];
    const taper = 1 - 0.85 * u * u;
    return { x: p[0], y: p[1], z: p[2], rx: thick * (0.6 + 0.4 * taper), ry: width * taper, top: 1, bot: 1, b0: s[0], b1: s[1], w1: s[2] };
  });
  return loft(st, sides, part, paint, true, true, frame);
}

/** a smooth 0 → 1 → 0 hash in [0, 1) from integers (stable per-tuft variation without an Rng) */
export function hash01(i: number, salt = 0): number {
  const h = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

/** one cross-section of a body for wrapPatch: centre height, half-width, half-height of the upper half */
export interface Section { y: number; rx: number; ry: number }

/**
 * A surface patch wrapped over a lofted body (a saddle blanket, a saddle seat): u runs along z from `z0` to `z1`, v runs
 * round the body from angle `a0` to `a1` (radians from the top, + = the animal's left), `lift(u, v)` metres off the
 * surface. Single-sided (it hugs the body), skinned per row by `skin(z)`. `paint` gets (…, part, u, v) — u as `t`,
 * v as the ring angle `a`.
 */
export function wrapPatch(section: (z: number) => Section, z0: number, z1: number, a0: number, a1: number,
  lift: (u: number, v: number) => number, nu: number, nv: number, skin: (z: number) => Skin, part: string, paint: Paint): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], col: number[] = [], si: number[] = [], sw: number[] = [], fl: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i <= nu; i++) {
    const u = i / nu, z = z0 + (z1 - z0) * u;
    const s = section(z), sk = skin(z);
    for (let j = 0; j <= nv; j++) {
      const v = j / nv, a = a0 + (a1 - a0) * v;
      const sa = Math.sin(a), ca = Math.cos(a);
      let nx = sa / s.rx, ny = ca / s.ry;
      const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const off = lift(u, v);
      const x = sa * s.rx + nx * off, y = s.y + ca * s.ry + ny * off;
      pos.push(x, y, z); nor.push(nx, ny, 0); uv.push(u, v);
      paint(c, x, y, z, nx, ny, 0, part, u, v);
      col.push(c.r, c.g, c.b);
      si.push(sk[0], sk[1], 0, 0); sw.push(1 - sk[2], sk[2], 0, 0); fl.push(0);
    }
  }
  const row = nv + 1;
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const p = i * row + j, q = p + 1, r = p + row, t = r + 1;
    idx.push(p, r, q, q, r, t);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setAttribute('furLen', new THREE.Float32BufferAttribute(fl, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
