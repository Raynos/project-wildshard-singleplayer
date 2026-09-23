import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loft, S, mix, sstep, srgb, setShag, type Paint } from './loft';

/**
 * Fat-tailed steppe sheep — the MODEL of the camp flock (Nalati, row B4). Sheep are not AnimalManager animals: a flock
 * of 20–60 is ONE InstancedMesh animated in the vertex shader (`src/entities/Flock.ts`), so this file registers no
 * species — it builds the static geometry the flock instances.
 *
 * The geometry carries `aRig` (vec3: part a, part b, weight of b) instead of a skin: parts are 0 body, 1 head + neck,
 * 2–5 legs FL FR BL BR, 6 the fat tail. `SHEEP_PIVOTS` are the joints the shader swings each part about (the flock's
 * per-instance gait phase / walk / graze / death drive the angles). Colours are vertex colours × the instance colour
 * (cream, fawn, brown, near-black wool). 0.72 m at the shoulder, ~1.1 m nose to tail.
 */

export const SHEEP_PIVOTS: [number, number, number][] = [
  [0, 0.60, 0.0],      // 0 body (unused)
  [0, 0.66, 0.36],     // 1 head: the neck root
  [0.12, 0.44, 0.27],  // 2 FL
  [-0.12, 0.44, 0.27], // 3 FR
  [0.12, 0.46, -0.30], // 4 BL
  [-0.12, 0.46, -0.30],// 5 BR
  [0, 0.56, -0.44],    // 6 tail
];

const WOOL = srgb(0.93, 0.88, 0.78), WOOL_SHADE = srgb(0.78, 0.72, 0.62), FACE = srgb(0.30, 0.20, 0.14), NOSE = srgb(0.12, 0.09, 0.08);
const LEG = srgb(0.26, 0.19, 0.15), HOOF = srgb(0.08, 0.07, 0.06), EAR_IN = srgb(0.62, 0.42, 0.38), EYE = srgb(0.03, 0.025, 0.02);

const sheepPaint: Paint = (out, _x, y, _z, _nx, ny, _nz, part, t) => {
  switch (part) {
    case 'body': mix(out, WOOL, WOOL_SHADE, sstep(0.0, -0.8, ny) * 0.8 + sstep(0.5, 0.3, y) * 0.3); break;
    case 'neck': mix(out, WOOL, WOOL_SHADE, 0.2); break;
    case 'head': mix(out, FACE, NOSE, sstep(0.8, 0.97, t)); break;
    case 'ear': mix(out, FACE, EAR_IN, sstep(0.2, 0.8, -ny) * 0.6); break;
    case 'leg': mix(out, LEG, HOOF, sstep(0.07, 0.03, y)); break;
    case 'eye': out.copy(EYE); break;
    default: out.copy(WOOL);
  }
};

/** Build the flock's instanced geometry (position / normal / color / aRig), about 3k triangles. */
export function buildSheepGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const BODY = 0, HEAD = 1, TAIL = 6;
  setShag(0.03);   // lumpy wool
  parts.push(loft([
    S(0, 0.60, -0.50, 0.03, 0.03, BODY),
    S(0, 0.61, -0.47, 0.17, 0.17, BODY, TAIL, 0.4),
    S(0, 0.61, -0.38, 0.27, 0.25, BODY),
    S(0, 0.61, -0.20, 0.31, 0.28, BODY),
    S(0, 0.61, 0.02, 0.32, 0.29, BODY),
    S(0, 0.62, 0.20, 0.30, 0.28, BODY),
    S(0, 0.64, 0.34, 0.23, 0.24, BODY, HEAD, 0.2),
    S(0, 0.66, 0.43, 0.13, 0.15, BODY, HEAD, 0.6),
    S(0, 0.67, 0.46, 0.03, 0.03, HEAD),
  ], 18, 'body', sheepPaint));
  // the fat rump / tail: a heavy pad under the back of the fleece
  parts.push(loft([
    S(0, 0.56, -0.40, 0.05, 0.05, TAIL),
    S(0, 0.52, -0.47, 0.16, 0.13, TAIL),
    S(0, 0.44, -0.50, 0.17, 0.12, TAIL),
    S(0, 0.36, -0.48, 0.11, 0.07, TAIL),
    S(0, 0.33, -0.46, 0.03, 0.03, TAIL),
  ], 12, 'body', sheepPaint));
  setShag(0);
  // neck + head: short woolly neck, a dark narrow face, a roman nose
  parts.push(loft([
    S(0, 0.66, 0.36, 0.11, 0.12, BODY, HEAD, 0.5),
    S(0, 0.70, 0.46, 0.09, 0.10, HEAD),
    S(0, 0.72, 0.52, 0.07, 0.08, HEAD),
    S(0, 0.73, 0.54, 0.02, 0.02, HEAD),
  ], 12, 'neck', sheepPaint, false, true));
  parts.push(loft([
    S(0, 0.73, 0.50, 0.05, 0.06, HEAD),
    S(0, 0.735, 0.54, 0.068, 0.075, HEAD),
    S(0, 0.715, 0.60, 0.064, 0.07, HEAD),
    S(0, 0.68, 0.66, 0.052, 0.058, HEAD),
    S(0, 0.645, 0.705, 0.045, 0.048, HEAD),
    S(0, 0.625, 0.728, 0.035, 0.036, HEAD),
    S(0, 0.62, 0.735, 0.01, 0.01, HEAD),
  ], 12, 'head', sheepPaint));
  for (const sx of [1, -1]) {
    // drooping ears, out to the side
    parts.push(loft([
      S(sx * 0.05, 0.745, 0.55, 0.02, 0.012, HEAD),
      S(sx * 0.10, 0.735, 0.545, 0.03, 0.01, HEAD),
      S(sx * 0.15, 0.715, 0.55, 0.022, 0.008, HEAD),
      S(sx * 0.17, 0.705, 0.555, 0.006, 0.004, HEAD),
    ], 6, 'ear', sheepPaint, true, true, 'z'));
    const eye = new THREE.SphereGeometry(0.011, 6, 5);
    eye.translate(sx * 0.052, 0.725, 0.605);
    parts.push(plain(eye, HEAD, 'eye'));
  }
  // legs: thin and dark under the fleece
  const legs: [number, number, number, number][] = [[0.12, 0.27, 2, 1], [-0.12, 0.27, 3, 1], [0.12, -0.30, 4, 0], [-0.12, -0.30, 5, 0]];
  for (const [x, z, bone, front] of legs) {
    parts.push(loft([
      S(x, 0.48, z, 0.055, 0.06, BODY, bone, 0.6),
      S(x, 0.38, z + (front ? 0.0 : -0.02), 0.042, 0.048, bone),
      S(x, 0.22, z + (front ? 0.01 : -0.03), 0.026, 0.028, bone),
      S(x, 0.08, z + 0.01, 0.024, 0.026, bone),
      S(x, 0.02, z + 0.02, 0.03, 0.034, bone),
      S(x, 0.0, z + 0.02, 0.01, 0.01, bone),
    ], 8, 'leg', sheepPaint));
  }
  // loft() gives skinIndex / skinWeight: fold them into aRig (part a, part b, weight of b), drop the rest
  const merged = mergeGeometries(parts.map((g) => {
    const si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight');
    const rig = new Float32Array(si.count * 3);
    for (let i = 0; i < si.count; i++) { rig[i * 3] = si.getX(i); rig[i * 3 + 1] = si.getY(i); rig[i * 3 + 2] = sw.getY(i); }
    const out = new THREE.BufferGeometry();
    out.setIndex(g.index);
    out.setAttribute('position', g.getAttribute('position'));
    out.setAttribute('normal', g.getAttribute('normal'));
    out.setAttribute('color', g.getAttribute('color'));
    out.setAttribute('aRig', new THREE.BufferAttribute(rig, 3));
    return out;
  }), false);
  merged.computeBoundingSphere();
  if (merged.boundingSphere !== null) merged.boundingSphere.radius += 0.4;
  return merged;
}

/** colour + rigid rig for a plain geometry (the eyes) */
function plain(g: THREE.BufferGeometry, part: number, name: string): THREE.BufferGeometry {
  const p = g.getAttribute('position'), n = g.getAttribute('normal');
  const col = new Float32Array(p.count * 3), si = new Float32Array(p.count * 4), sw = new Float32Array(p.count * 4);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    sheepPaint(c, p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i), name, 0.5, 0);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    si[i * 4] = part; si[i * 4 + 1] = part; sw[i * 4] = 1;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.deleteAttribute('uv');
  return g;
}
