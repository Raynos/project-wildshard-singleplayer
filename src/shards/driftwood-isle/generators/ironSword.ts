/** Original fixed blade and fittings, generated offline without material or pickup state. */
import * as THREE from 'three';
import { lin } from '@wildshard/engine/math/color';

/** steel: bevelled edges bright, flats mid, the fuller dark; iron guard / pommel; leather grip + wrap */
const C = {
  edge: lin(0xeef1f6), flat: lin(0xb4bac5), fuller: lin(0x848b98), tip: lin(0xe6e9ef),
  iron: lin(0x3a3c42), ironLight: lin(0x585b63), ironDark: lin(0x25272c),
  grip: lin(0x4a2d1a), wrap: lin(0x6e4629), pommelCap: lin(0x6b6e77), gem: lin(0xd94b3a),
};
/** per-FACE coloured triangles: each quad between ring r and r+1, segment i, takes `segCol[i]` (with a tiny per-face jitter) */
function loftFaces(rings: THREE.Vector3[][], segCol: THREE.Color[], jitter = 0.05, seed = 7): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [];
  let h = seed * 7919;
  const push = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, k: THREE.Color) => {
    h = (Math.imul(h, 1103515245) + 12345) & 0x7fffffff;
    const j = 1 + ((h / 0x7fffffff) - 0.5) * 2 * jitter;
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) col.push(k.r * j, k.g * j, k.b * j);
  };
  for (let r = 0; r < rings.length - 1; r++) {
    const a = rings[r], b = rings[r + 1];
    if (a === undefined || b === undefined) continue;
    const n = a.length;
    for (let i = 0; i < n; i++) {
      const a0 = a[i], a1 = a[(i + 1) % n], b0 = b[i], b1 = b[(i + 1) % n], k = segCol[i % segCol.length];
      if (a0 === undefined || a1 === undefined || b0 === undefined || b1 === undefined || k === undefined) continue;
      push(a0, a1, b1, k);
      push(a0, b1, b0, k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
/** a flat-shaded, per-face-coloured copy of a three primitive */
function facet(g: THREE.BufferGeometry, k: THREE.Color, jitter = 0.06, seed = 3): THREE.BufferGeometry {
  const ni = g.index ? g.toNonIndexed() : g;
  for (const a of Object.keys(ni.attributes)) if (a !== 'position') ni.deleteAttribute(a);
  ni.computeVertexNormals();
  const n = ni.getAttribute('position').count, c = new Float32Array(n * 3);
  let h = seed * 7919;
  for (let f = 0; f < n; f += 3) {
    h = (Math.imul(h, 1103515245) + 12345) & 0x7fffffff;
    const j = 1 + ((h / 0x7fffffff) - 0.5) * 2 * jitter;
    for (let v = f; v < f + 3; v++) { c[v * 3] = k.r * j; c[v * 3 + 1] = k.g * j; c[v * 3 + 2] = k.b * j; }
  }
  ni.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return ni;
}
/** blade section at height y: 10 points — edges at ±w, flats at ±t, the fuller a little inset either side of the spine */
function bladeSection(y: number, w: number, t: number, fuller = 0.78): THREE.Vector3[] {
  const fw = w * 0.2, ft = t * fuller, sw = w * 0.58;
  return [
    new THREE.Vector3(w, y, 0), new THREE.Vector3(sw, y, t), new THREE.Vector3(fw, y, ft), new THREE.Vector3(-fw, y, ft), new THREE.Vector3(-sw, y, t),
    new THREE.Vector3(-w, y, 0), new THREE.Vector3(-sw, y, -t), new THREE.Vector3(-fw, y, -ft), new THREE.Vector3(fw, y, -ft), new THREE.Vector3(sw, y, -t),
  ];
}
const octagon = (y: number, r: number, rot = 0) => { const o: THREE.Vector3[] = []; for (let i = 0; i < 8; i++) { const a = rot + (i / 8) * Math.PI * 2; o.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); } return o; };
const merge = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const pos: number[] = [], col: number[] = [], nor: number[] = [];
  for (const p of parts) { pos.push(...(p.getAttribute('position').array as Float32Array)); col.push(...(p.getAttribute('color').array as Float32Array)); nor.push(...(p.getAttribute('normal').array as Float32Array)); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
};


export function ironSwordGeometry(): { blade: THREE.BufferGeometry; fittings: THREE.BufferGeometry } {
  // ── blade: 0.92 m, wide at the ricasso, a gentle taper, then a 10 cm point ──
  const guardY = 0.16, y0 = guardY + 0.02, L = 0.94;
  const w = (f: number) => 0.07 * (1 - f * 0.38), t = (f: number) => 0.016 * (1 - f * 0.3);
  const rings: THREE.Vector3[][] = [];
  for (const f of [0, 0.18, 0.38, 0.58, 0.76, 0.88]) rings.push(bladeSection(y0 + L * f, w(f), t(f)));
  rings.push(bladeSection(y0 + L * 0.94, w(0.88) * 0.66, t(0.88) * 0.8, 0.9));
  rings.push(bladeSection(y0 + L * 0.985, w(0.88) * 0.22, t(0.88) * 0.45, 1));
  const tip = new THREE.Vector3(0, y0 + L, 0);
  const base = rings[0];
  if (base === undefined) throw new Error('IronSword: no base ring');
  rings.push(base.map(() => tip.clone()));
  const steelCols = [C.edge, C.flat, C.fuller, C.flat, C.edge, C.edge, C.flat, C.fuller, C.flat, C.edge];
  const blade = loftFaces(rings, steelCols, 0.035, 11);
  // ricasso cap over the guard (the blade's base face)
  const capPos: number[] = [], capCol: number[] = [];
  for (let i = 0; i < base.length; i++) { const a = base[i], b = base[(i + 1) % base.length]; if (a === undefined || b === undefined) continue; capPos.push(0, y0, 0, b.x, b.y, b.z, a.x, a.y, a.z); for (let k = 0; k < 3; k++) capCol.push(C.flat.r, C.flat.g, C.flat.b); }
  const cap = new THREE.BufferGeometry(); cap.setAttribute('position', new THREE.Float32BufferAttribute(capPos, 3)); cap.setAttribute('color', new THREE.Float32BufferAttribute(capCol, 3)); cap.computeVertexNormals();
  // ── guard: a dark iron cross, thick at the centre block, the arms swept a little toward the blade, knobbed ends ──
  const parts: THREE.BufferGeometry[] = [];
  const armL = 0.21;
  for (const s of [-1, 1]) {
    const arm = new THREE.BoxGeometry(armL, 0.034, 0.052, 3, 1, 1);
    const p = arm.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); const f = (x + armL / 2) / armL; p.setY(i, p.getY(i) * (1 - f * 0.25) + f * 0.028); p.setZ(i, p.getZ(i) * (1 - f * 0.3)); } // tapers and lifts toward the tip
    arm.translate(s * (armL / 2 + 0.04), guardY, 0);
    if (s < 0) arm.scale(-1, 1, 1);
    parts.push(facet(arm, C.iron, 0.07, 21 + s));
    parts.push(facet(new THREE.SphereGeometry(0.03, 6, 4).translate(s * (armL + 0.05), guardY + 0.026, 0), C.ironLight, 0.06, 31 + s));
  }
  parts.push(facet(new THREE.BoxGeometry(0.1, 0.066, 0.07).translate(0, guardY, 0), C.ironDark, 0.05, 41));
  parts.push(facet(new THREE.OctahedronGeometry(0.02, 0).translate(0, guardY, 0.036), C.gem, 0.03, 42)); // a garnet set in the block

  // ── grip: leather core with a spiral of wrap ridges (alternating ring radii, alternating colours) ──
  const gripTop = guardY - 0.031, gripLen = 0.27, ridges = 9;
  const gr: THREE.Vector3[][] = []; const gc: THREE.Color[] = [];
  for (let i = 0; i <= ridges; i++) { const y = gripTop - (i / ridges) * gripLen; gr.push(octagon(y, i % 2 ? 0.0245 : 0.021, i * 0.2)); }
  for (let i = 0; i < 8; i++) gc.push(i % 2 ? C.grip : C.wrap);
  parts.push(loftFaces(gr, gc, 0.07, 51));
  // ── pommel: a faceted wheel on a short neck ──
  const neckY = gripTop - gripLen;
  parts.push(facet(new THREE.CylinderGeometry(0.02, 0.026, 0.03, 8).translate(0, neckY - 0.014, 0), C.ironLight, 0.05, 61));
  parts.push(facet(new THREE.SphereGeometry(0.048, 7, 5).scale(1, 0.85, 0.72).translate(0, neckY - 0.06, 0), C.iron, 0.07, 62));
  parts.push(facet(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 8).rotateX(Math.PI / 2).translate(0, neckY - 0.06, 0.03), C.pommelCap, 0.04, 63));
  return { blade: merge([blade, cap]), fittings: merge(parts) };
}
