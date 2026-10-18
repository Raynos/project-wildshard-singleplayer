// Offline ambient geometry; live drawing reads the prepared pack.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { smoothstep as sstep } from '@wildshard/engine/core/noise';
import { loft, S, mix, srgb, type Paint } from '@wildshard/engine/entities/species/loft';

export function wingGeo(): THREE.BufferGeometry {
  const v = [0, 0, 0.004, 0.034, 0.004, 0.02, 0.044, 0, -0.004, 0.03, 0, -0.026, 0, 0, -0.012];
  const idx = [0, 1, 2, 0, 2, 3, 0, 3, 4];
  const back = [0, 2, 1, 0, 3, 2, 0, 4, 3];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  // dark at the hinge, the colour in the middle, dark wingtips (the instance colour tints it)
  g.setAttribute('color', new THREE.Float32BufferAttribute([0.15, 0.12, 0.1, 0.6, 0.55, 0.5, 0.9, 0.88, 0.85, 0.75, 0.72, 0.7, 0.2, 0.18, 0.16], 3));
  g.setIndex([...idx, ...back]);
  g.computeBoundingSphere();
  return g;
}

/** half a raptor (its right side): half the body, one long fingered wing on +x, half the tail; mirrored for the left */
export function halfBirdGeo(): THREE.BufferGeometry {
  // (x, y, z) with −z forward; wing chord ~0.45 at the root, tapering to fingers at 1.0 m
  const v: number[] = [
    0, 0.02, -0.55, 0.07, 0, -0.35, 0.09, 0.0, 0.05, 0, 0.04, 0.2, 0, -0.05, -0.1,  // body: beak, shoulder, hip, back, belly (0-4)
    0.07, 0.0, -0.22, 0.45, 0.03, -0.2, 0.85, 0.06, -0.12, 1.0, 0.07, 0.0, 0.8, 0.05, 0.12, 0.4, 0.02, 0.2, 0.08, 0.0, 0.15, // wing (5-11)
    0, 0.02, 0.3, 0.13, 0.02, 0.55, 0, 0.02, 0.6, // tail (12-14)
  ];
  const tri = [
    0, 1, 3, 1, 2, 3, 0, 4, 1, 1, 4, 2,          // body top + belly
    5, 6, 11, 6, 10, 11, 6, 7, 10, 7, 9, 10, 7, 8, 9, // wing
    12, 13, 14,                                  // tail
  ];
  const back: number[] = [];
  for (let i = 0; i < tri.length; i += 3) back.push(tri[i] ?? 0, tri[i + 2] ?? 0, tri[i + 1] ?? 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex([...tri, ...back]);
  g.computeVertexNormals();
  const n = v.length / 3, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = v[i * 3] ?? 0, z = v[i * 3 + 2] ?? 0;
    // rufous body, darker wing, black fingertips, a pale band under the hand
    let r = 0.36, gg = 0.22, b = 0.12;
    if (x > 0.3) { r = 0.22; gg = 0.15; b = 0.1; }
    if (x > 0.8) { r = 0.06; gg = 0.05; b = 0.05; }
    if (z > 0.5) { r = 0.42; gg = 0.28; b = 0.16; }
    col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

const FUR = srgb(0.62, 0.50, 0.34), BACK = srgb(0.42, 0.34, 0.25), BELLY = srgb(0.78, 0.68, 0.50), DARK = srgb(0.16, 0.12, 0.09);
const paint: Paint = (out, _x, y, _z, _nx, ny, _nz, part, t) => {
  if (part === 'eye') { out.copy(DARK); return; }
  if (part === 'tail') { mix(out, BACK, DARK, sstep(0.5, 1, t)); return; }
  out.copy(FUR);
  mix(out, out, BACK, sstep(0.2, 0.9, ny) * 0.8);
  mix(out, out, BELLY, sstep(-0.2, -0.8, ny));
  if (part === 'head') mix(out, out, DARK, sstep(0.85, 0.98, t) * 0.8 + sstep(0.26, 0.3, y) * 0.2);
};

export function buildMarmotGeometry(): THREE.BufferGeometry {
  // ~0.5 m long, plump; origin at the hind feet (the stand pivot), +Z forward
  const parts = [
    loft([S(0, 0.10, -0.16, 0.02, 0.02, 0), S(0, 0.11, -0.13, 0.09, 0.08, 0), S(0, 0.12, -0.02, 0.12, 0.11, 0), S(0, 0.13, 0.10, 0.10, 0.10, 0), S(0, 0.15, 0.18, 0.07, 0.07, 0), S(0, 0.16, 0.21, 0.02, 0.02, 0)], 12, 'body', paint),
    loft([S(0, 0.16, 0.17, 0.055, 0.055, 0), S(0, 0.17, 0.22, 0.06, 0.055, 0), S(0, 0.16, 0.27, 0.042, 0.04, 0), S(0, 0.15, 0.30, 0.02, 0.02, 0)], 10, 'head', paint),
    loft([S(0, 0.11, -0.15, 0.025, 0.025, 0), S(0, 0.09, -0.23, 0.022, 0.02, 0), S(0, 0.08, -0.27, 0.01, 0.01, 0)], 6, 'tail', paint),
  ];
  for (const sx of [1, -1]) {
    parts.push(loft([S(sx * 0.07, 0.10, 0.08, 0.025, 0.025, 0), S(sx * 0.075, 0.03, 0.09, 0.02, 0.02, 0), S(sx * 0.075, 0.0, 0.1, 0.012, 0.012, 0)], 6, 'body', paint));
    const eye = new THREE.SphereGeometry(0.009, 6, 4);
    eye.translate(sx * 0.038, 0.185, 0.25);
    const n = eye.getAttribute('position').count;
    const col = new Float32Array(n * 3).fill(0.02);
    eye.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(eye);
  }
  const geos = parts.map((g) => {
    const out = new THREE.BufferGeometry();
    out.setIndex(g.index);
    out.setAttribute('position', g.getAttribute('position'));
    out.setAttribute('normal', g.getAttribute('normal'));
    out.setAttribute('color', g.getAttribute('color'));
    return out;
  });
  const merged = mergeGeometries(geos, false);
  merged.computeBoundingSphere();
  return merged;
}

