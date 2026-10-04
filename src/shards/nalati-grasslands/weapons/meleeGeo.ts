import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { viewmodelMaterial } from '@wildshard/engine/combat/view/ranged';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';



/**
 * meleeGeo — the smooth, vertex-painted geometry kit the Nalati melee viewmodels are built from (Sabre.ts, Spear.ts):
 * painterly style B (art/nalati-grasslands/round-1/1-art-style/style-B-painterly.jpg) — soft smooth shapes, colour
 * painted per vertex (gradients, bands), no textures; lit by the shared painterly material (src/engine/world/painterly.ts).
 *
 *   tube(rings, colorAt, { capStart, capEnd })   indexed, smooth-normal tube through rings of equal vertex count
 *   section(n, rx, rz, y, rot?)                  one elliptical ring at height `y` (the usual ring for `tube`)
 *   blob(rx, ry, rz, col, seg?)                  a smooth ellipsoid (knuckles, knots, pommel caps)
 *   xf(geo, x, y, z, rx, ry, rz, s?)             transform in place (Euler XYZ), returns geo
 *   merge(parts)                                 mergeGeometries over indexed parts (position / normal / color)
 *   meleeMaterial(sky)                           the viewmodel's painterly material (transparent queue: the depth-clear trick)
 *   forearm(opts)                                the Nalati rider's forearm: fist, leather bracer, a white-fleece cuff and
 *                                                the red embroidered wool sleeve (combat mockups) running out of frame
 *
 * Every builder is build-time only (allocates freely); nothing here runs per frame.
 */

export type ColorAt = (v: number, a: number, out: THREE.Color) => THREE.Color;
/** sRGB hex → linear (vertex colours are linear) */

/** ring of `n` points on an ellipse (rx across X, rz across Z) at height y; `rot` spins the start point */
export function section(n: number, rx: number, rz: number, y: number, rot = 0, cx = 0, cz = 0): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) { const a = rot + (i / n) * Math.PI * 2; out.push(new THREE.Vector3(cx + Math.cos(a) * rx, y, cz + Math.sin(a) * rz)); }
  return out;
}

/**
 * Indexed tube through `rings` (each the same vertex count, wound the same way). Seam vertices are duplicated so the
 * colour function can paint around (`a` 0..1) as well as along (`v` 0..1, by ring index). Normals are smooth.
 * `capStart` / `capEnd` close the ends with a fan to the ring centre (a pointed cap when `tipStart` / `tipEnd` offsets it).
 */
export function tube(rings: THREE.Vector3[][], colorAt: ColorAt, opts: { capStart?: boolean; capEnd?: boolean } = {}): THREE.BufferGeometry {
  const nr = rings.length, n = rings[0]?.length ?? 0;
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const c = new THREE.Color();
  for (let r = 0; r < nr; r++) {
    const ring = rings[r] ?? [];
    for (let i = 0; i <= n; i++) {
      const p = ring[i % n]; if (p === undefined) continue;
      pos.push(p.x, p.y, p.z);
      colorAt(nr > 1 ? r / (nr - 1) : 0, i / n, c); col.push(c.r, c.g, c.b);
    }
  }
  const row = n + 1;
  for (let r = 0; r < nr - 1; r++) for (let i = 0; i < n; i++) {
    const a = r * row + i, b = a + 1, d = a + row, e = d + 1;
    idx.push(a, b, e, a, e, d);
  }
  const addCap = (r: number, flip: boolean) => {
    const ring = rings[r] ?? []; if (ring.length === 0) return;
    const ctr = new THREE.Vector3(); for (const p of ring) ctr.add(p); ctr.multiplyScalar(1 / ring.length);
    const ci = pos.length / 3; pos.push(ctr.x, ctr.y, ctr.z);
    colorAt(nr > 1 ? r / (nr - 1) : 0, 0, c); col.push(c.r, c.g, c.b);
    for (let i = 0; i < n; i++) { const a = r * row + i, b = a + 1; if (flip) idx.push(ci, b, a); else idx.push(ci, a, b); }
  };
  if (opts.capStart) addCap(0, false);
  if (opts.capEnd) addCap(nr - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** smooth ellipsoid, painted one colour (optionally darkened toward -Y: `shade` 0..1) */
export function blob(rx: number, ry: number, rz: number, col: THREE.Color, seg = 10, shade = 0.15): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, seg, Math.max(4, Math.round(seg * 0.7)));
  g.scale(rx, ry, rz);
  g.deleteAttribute('uv');
  const p = g.getAttribute('position'), n = p.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const k = 1 - shade * (0.5 - 0.5 * p.getY(i) / ry); c[i * 3] = col.r * k; c[i * 3 + 1] = col.g * k; c[i * 3 + 2] = col.b * k; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

const _m = new THREE.Matrix4(), _e = new THREE.Euler();
export function xf(g: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1): THREE.BufferGeometry {
  if (s !== 1) g.scale(s, s, s);
  if (rx !== 0 || ry !== 0 || rz !== 0) g.applyMatrix4(_m.makeRotationFromEuler(_e.set(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
}

/** merge indexed parts (position / normal / color only) */
export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  for (const p of parts) for (const k of Object.keys(p.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') p.deleteAttribute(k);
  const g = mergeGeometries(parts, false);
  g.computeBoundingSphere();
  return g;
}

/** the viewmodels' painterly material: rim-lit, soft bands; transparent queue so it draws after the depth clear (renderOrder 999) */
export function meleeMaterial(sky: Sky, rim = 0.55): THREE.Material {
  const m = painterlyMaterial(sky, { vertexColors: true, rim, bands: 0.7, transparent: true, depthWrite: true });
  m.name = 'nalati-viewmodel';
  return m;
}

/**
 * The viewmodels' METAL (blade, spear head, socket, gold fittings): the shared viewmodel PBR program (Crossbow.ts
 * `viewmodelMaterial` — already compiled for the rifle in every shard, so no new program) at metalness 1: the painted
 * sky's environment is what the steel reflects (the mockups' bright blade sheen). Vertex colours tint it (steel / gold /
 * dark iron); geometry drawn with it needs a `uv` attribute (`withUV`). Transparent queue for the depth-clear trick.
 */
export function steelMaterial(sky: Sky, roughness = 0.38): THREE.Material {
  const m = viewmodelMaterial(sky, 'nalati-steel', { metalness: 0.55, roughness, envMapIntensity: 0.7 });
  m.transparent = true; m.depthWrite = true;
  return m;
}
/** add a zero `uv` (the PBR viewmodel program samples its 1×1 filler maps through it) */
export function withUV(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!g.hasAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
  return g;
}

const _t = new THREE.Vector3(), _n = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3();
/**
 * Sweep a circle (`sides` points, radius `radius(u)`, u 0..1 along the path) along `path` with parallel-transport frames —
 * wraps, bindings, quillons, horsehair strands. Smooth normals; `colorAt(u, a)`; ends capped when `caps`.
 */
export function sweep(path: THREE.Vector3[], radius: (u: number) => number, sides: number, colorAt: ColorAt, caps = true, squash = 1): THREE.BufferGeometry {
  const rings: THREE.Vector3[][] = [];
  const n = path.length;
  const first = path[0], second = path[1];
  if (first === undefined || second === undefined) throw new Error('sweep: a path needs two points');
  _t.subVectors(second, first).normalize();
  _up.set(0, 1, 0); if (Math.abs(_t.dot(_up)) > 0.9) _up.set(1, 0, 0);
  _n.crossVectors(_t, _up).normalize(); _b.crossVectors(_t, _n).normalize();
  for (let i = 0; i < n; i++) {
    const p = path[i] ?? first, prev = path[Math.max(0, i - 1)] ?? p, next = path[Math.min(n - 1, i + 1)] ?? p;
    const t = new THREE.Vector3().subVectors(next, prev).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(_t, t); // parallel transport: carry the frame onto the new tangent
    _n.applyQuaternion(q); _b.applyQuaternion(q); _t.copy(t);
    const r = radius(n > 1 ? i / (n - 1) : 0), ring: THREE.Vector3[] = [];
    for (let k = 0; k < sides; k++) { const a = (k / sides) * Math.PI * 2; ring.push(p.clone().addScaledVector(_n, Math.cos(a) * r).addScaledVector(_b, Math.sin(a) * r * squash)); }
    rings.push(ring);
  }
  return tube(rings, colorAt, { capStart: caps, capEnd: caps });
}
/** a helix path round the Y axis (a leather wrap / binding): radius r, from y0 to y1, `turns` turns, `steps` points */
export function helix(r: number, y0: number, y1: number, turns: number, steps: number, phase = 0): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i++) { const f = i / steps, a = phase + f * turns * Math.PI * 2; out.push(new THREE.Vector3(Math.cos(a) * r, y0 + (y1 - y0) * f, Math.sin(a) * r)); }
  return out;
}
