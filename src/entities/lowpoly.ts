import * as THREE from 'three';
import { loft, S, srgb, mix, sstep, type Paint } from './species/loft';
import type { VariantDef } from './species/registry';

/**
 * Low-poly (faceted, flat-shaded, untextured) rendering of the procedural animals — the Driftwood
 * Isle look (`ChunkDef.style === 'lowpoly'`). The skeleton, stations, bone names, dims and every
 * bit of Animal.ts stay the same; only what the loft produces and how it is lit changes:
 *
 *   species/loft.ts: setLowPoly(true) → every loft has 4–6 sides (lowPolySides) and no shag noise
 *   facetGeometry(geo)         de-index + flat per-face normals + a per-face pastel lightness jitter
 *   boarPaintLow(v) / deerPaintLow(v)   flat pastel-saturated vertex colours, no noise, no baked AO
 *   crestSpikes(...)           the boar's bristle crest as a row of faceted spikes
 *   lowPolyMaterials()         plain flat-shaded MeshStandardMaterials (no fur texture, no fur shells)
 *
 * AnimalFactory switches all of this on with `new AnimalFactory(sky, { style: 'lowpoly' })`; the
 * PBR path is untouched.
 */

/** material groups that keep their exact colour (eyes): no facet jitter */
const NO_JITTER_GROUPS = new Set([2]);

/**
 * Turn the merged indexed model into a faceted one: every triangle gets its own three vertices and a
 * flat normal (`computeVertexNormals` on non-indexed geometry), and each face's colour is nudged a
 * little so neighbouring facets read as separate planes even when they face the same way (the mockup
 * boar's "bristly" surface). Material groups and the skin attributes survive the de-indexing.
 */
export function facetGeometry(geo: THREE.BufferGeometry, jitter = 0.12): THREE.BufferGeometry {
  const g = geo.toNonIndexed();
  geo.dispose();
  g.computeVertexNormals();
  const col = g.attributes.color as THREE.BufferAttribute;
  const pos = g.attributes.position as THREE.BufferAttribute;
  const skip = (v: number) => g.groups.some((gr) => NO_JITTER_GROUPS.has(gr.materialIndex ?? 0) && v >= gr.start && v < gr.start + gr.count);
  for (let v = 0; v < pos.count; v += 3) {
    if (skip(v)) continue;
    // deterministic per-face hash from the centroid so instances of the same model match
    const cx = pos.getX(v) + pos.getX(v + 1) + pos.getX(v + 2);
    const cy = pos.getY(v) + pos.getY(v + 1) + pos.getY(v + 2);
    const cz = pos.getZ(v) + pos.getZ(v + 1) + pos.getZ(v + 2);
    const h = Math.sin(cx * 127.1 + cy * 311.7 + cz * 74.7) * 43758.5453;
    const m = 1 + (h - Math.floor(h) - 0.5) * 2 * jitter;
    for (let k = 0; k < 3; k++) col.setXYZ(v + k, col.getX(v + k) * m, col.getY(v + k) * m, col.getZ(v + k) * m);
  }
  g.computeBoundingSphere();
  g.boundingSphere!.radius += 0.6;
  g.computeBoundingBox();
  return g;
}

type RGB3 = [number, number, number];
const scaled = (c: RGB3, k: number, warm = 1): THREE.Color => srgb(Math.min(1, c[0] * k * warm), Math.min(1, c[1] * k), Math.min(1, c[2] * k / warm));

/**
 * Driftwood Isle boar: dark chocolate body, lighter warm back and crest, near-black legs, pink snout, ivory
 * tusks. Variant tints (black boar, Ironhide…) override `base`; the back / belly / leg shades derive from it.
 */
export function boarPaintLow(v?: VariantDef): Paint {
  const t = v?.tint ?? {};
  const baseC: RGB3 = t.base ?? [0.40, 0.255, 0.18];
  const base = srgb(...baseC), back = scaled(baseC, 1.45, 1.04), belly = scaled(baseC, 0.66);
  const cheek = scaled(baseC, 1.32, 1.03), muzzle = scaled(baseC, 0.8);
  const leg = scaled(baseC, 0.72), legDark = scaled(baseC, 0.42), hoof = srgb(...(t.hoof ?? [0.14, 0.10, 0.09]));
  const crest = scaled(baseC, 1.2, 1.04), crestTip = scaled(baseC, 1.75, 1.08), earIn = srgb(0.52, 0.32, 0.30);
  const snout = srgb(...(t.snout ?? [0.66, 0.40, 0.38]));
  const tuskC: RGB3 = t.tusk ?? [0.95, 0.91, 0.80];
  const tusk = srgb(...tuskC), tuskRoot = scaled(tuskC, 0.72), eye = srgb(...(t.eye ?? [0.02, 0.015, 0.01])), tail = scaled(baseC, 0.6);
  return (out, x, y, _z, nx, ny, _nz, part, tt) => {
    switch (part) {
      case 'body':
        out.copy(base);
        mix(out, out, back, sstep(0.1, 0.85, ny) * 0.9);
        mix(out, out, belly, sstep(-0.25, -0.8, ny));
        break;
      case 'neck': case 'head':
        out.copy(base);
        mix(out, out, back, sstep(0.3, 0.9, ny) * 0.6 * (1 - sstep(0.5, 0.8, tt)));
        mix(out, out, cheek, sstep(0.45, 0.8, tt) * sstep(0.35, 0.9, Math.abs(nx)) * 0.8);   // pale cheek bristles
        mix(out, out, muzzle, sstep(0.78, 0.95, tt));
        mix(out, out, belly, sstep(-0.35, -0.85, ny) * 0.7);
        break;
      case 'snout': out.copy(snout); break;
      case 'crest': mix(out, crest, crestTip, sstep(0.2, 1, tt)); break;
      case 'ear': out.copy(legDark); mix(out, out, earIn, sstep(0.1, 0.6, -nx * Math.sign(x)) * 0.8); break;
      case 'leg': mix(out, leg, legDark, sstep(0.45, 0.15, y)); break;
      case 'tail': out.copy(tail); break;
      case 'tusk': mix(out, tuskRoot, tusk, sstep(0.0, 0.4, tt)); break;
      case 'hoof': out.copy(hoof); break;
      case 'eye': out.copy(eye); break;
      default: out.copy(base);
    }
  };
}

/** Driftwood Isle deer: tan pastel body, cream belly / throat / rump, dark hooves and nose, bone antlers. */
export function deerPaintLow(v?: VariantDef): Paint {
  const t = v?.tint ?? {};
  const bodyC: RGB3 = t.body ?? [0.62, 0.46, 0.30];
  const body = srgb(...bodyC), back = scaled(bodyC, 0.82), neck = scaled(bodyC, 0.94), muzzle = scaled(bodyC, 0.74);
  const belly = srgb(...(t.belly ?? [0.86, 0.78, 0.62])), rump = scaled(t.belly ?? [0.86, 0.78, 0.62], 0.97);
  const nose = srgb(...(t.nose ?? [0.10, 0.08, 0.07])), earIn = srgb(0.80, 0.70, 0.58);
  const leg = scaled(bodyC, 0.84), legDark = scaled(bodyC, 0.55), hoof = srgb(...(t.hoof ?? [0.12, 0.09, 0.08]));
  const antlerC: RGB3 = t.antler ?? [0.55, 0.44, 0.32];
  const antler = srgb(...antlerC), antlerTip = scaled(antlerC, 1.55), eye = srgb(...(t.eye ?? [0.02, 0.015, 0.01]));
  return (out, x, y, z, nx, ny, _nz, part, tt) => {
    switch (part) {
      case 'body': {
        out.copy(body);
        mix(out, out, back, sstep(0.5, 0.95, ny) * 0.8);
        mix(out, out, belly, sstep(-0.2, -0.75, ny));
        const rd = Math.hypot(x * 1.2, (y - 0.98) * 1.3, (z + 0.9) * 0.9);
        mix(out, out, rump, sstep(0.30, 0.16, rd) * 0.9);
        break;
      }
      case 'neck': out.copy(neck); mix(out, out, belly, sstep(-0.3, -0.85, ny) * 0.85); break;
      case 'head':
        out.copy(neck);
        mix(out, out, muzzle, sstep(0.6, 0.9, tt) * 0.8);
        mix(out, out, belly, sstep(-0.3, -0.8, ny) * sstep(0.3, 0.7, tt) * 0.7);
        mix(out, out, nose, sstep(0.9, 0.97, tt));
        break;
      case 'ear': out.copy(back); mix(out, out, earIn, sstep(0.1, 0.6, -nx * Math.sign(x)) * 0.9); break;
      case 'leg': mix(out, leg, legDark, sstep(0.62, 0.3, y)); break;
      case 'tail': out.copy(back); mix(out, out, rump, sstep(-0.1, -0.7, ny) * 0.9); break;
      case 'antler': mix(out, antler, antlerTip, sstep(0.5, 1, tt) * 0.85); break;
      case 'hoof': out.copy(hoof); break;
      case 'eye': out.copy(eye); break;
      default: out.copy(body);
    }
  };
}

/**
 * The boar's dorsal crest as a serrated row of faceted spikes. `pts` are the crest points of species/boar.ts
 * ([z, y, ry, b0, b1, w1], `yOff` added to y); the ridge is resampled every ~8 cm between them so the spikes
 * overlap into a jagged fin, alternating tall / short, leaning back along the spine. Each spike is a 4-sided
 * pyramid skinned like the nearest crest point so it rides the neck / body bones.
 */
export function crestSpikes(pts: [number, number, number, number, number, number][], yOff: number, paint: Paint): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const P = pts.filter((p) => p[2] >= 0.03).sort((a, b) => a[0] - b[0]);   // rear → front
  if (P.length < 2) return out;
  const z0 = P[0][0], z1 = P[P.length - 1][0], step = 0.082;
  const n = Math.max(2, Math.round((z1 - z0) / step));
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n;
    let k = 0;
    while (k < P.length - 2 && P[k + 1][0] < z) k++;
    const a = P[k], b = P[k + 1], u = THREE.MathUtils.clamp((z - a[0]) / Math.max(1e-4, b[0] - a[0]), 0, 1);
    const y = a[1] + (b[1] - a[1]) * u, ry = a[2] + (b[2] - a[2]) * u;
    const near = u < 0.5 ? a : b;
    // the PBR fin sits mostly inside the back (its fur shells do the work); the spikes start at the skin
    const h = (ry * 1.8 + 0.03) * (i % 2 ? 0.72 : 1) * (0.8 + 0.2 * Math.sin(z * 5 + 1));
    const baseY = y + 0.02 + yOff;
    out.push(loft([
      S(0, baseY - 0.05, z, 0.034, 0.05, near[3], near[4], near[5]),
      S(0, baseY + h * 0.45, z - h * 0.2, 0.02, 0.03, near[3], near[4], near[5]),
      S(0, baseY + h, z - h * 0.55, 0.003, 0.003, near[3], near[4], near[5]),
    ], 4, 'crest', paint, false, false));
  }
  return out;
}

export interface LowPolyMaterials { fur: THREE.MeshStandardMaterial; hard: THREE.MeshStandardMaterial; eye: THREE.MeshPhysicalMaterial }

/** Flat-shaded body / hard-part / eye materials — three per species, shared by every instance (the body is cloned per animal for its tint). */
export function lowPolyMaterials(): LowPolyMaterials {
  const fur = new THREE.MeshStandardMaterial({ flatShading: true, vertexColors: true, roughness: 0.85, metalness: 0, color: new THREE.Color(1, 1, 1), envMapIntensity: 0.7 });
  const hard = new THREE.MeshStandardMaterial({ flatShading: true, vertexColors: true, roughness: 0.7, metalness: 0, color: new THREE.Color(1, 1, 1), envMapIntensity: 0.5 });   // matte: glossy hoof tops mirrored the sky as gold bands
  const eye = new THREE.MeshPhysicalMaterial({ roughness: 0.25, metalness: 0, vertexColors: true, color: new THREE.Color(1, 1, 1), clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.5 });
  return { fur, hard, eye };
}
