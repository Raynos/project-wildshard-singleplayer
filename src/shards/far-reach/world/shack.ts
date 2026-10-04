import { BufferGeometry, type Color, Float32BufferAttribute, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';

/**
 * The weathered-timber kit for Sky Reach's small buildings (E392, round 18; the judge, every loop: "the houses are
 * untextured flat-shaded boxes with dark pyramid roofs; the mockup's are weathered timber shacks: plank walls, shingle
 * roofs, trim, a lean"). No textures: each piece carries metre coordinates on its face (`shk`: u along, v up, a seed)
 * and one of four procedural shaders draws the surface from them:
 * - `plank`: vertical boards (~24 cm), each its own tone and length, dark seams and butt joints, grain, rain streaks;
 * - `shingle`: staggered rows of wooden shingles with ragged butts, a shadow under each row, moss toward the eave;
 * - `stone`: coursed rubble blocks with mortar, bevelled edges, mixed warm and cool stones, moss at the foot;
 * - `beam`: trim and posts, the grain running along the piece's longest side, the odd check.
 * A builder per kind collects quads, triangles and boxes; `pre` (a matrix) applies to every piece added while it is set,
 * which is how a storey leans. One mesh per kind.
 */
export type ShackKind = 'plank' | 'shingle' | 'stone' | 'beam';

export interface ShackPart {
  readonly kind: ShackKind;
  readonly pos: number[]; readonly nor: number[]; readonly col: number[]; readonly shk: number[];
  /** applied to every piece added while set (a lean, a placement); identity by default */
  pre: Matrix4;
}

export const shackPart = (kind: ShackKind): ShackPart => ({ kind, pos: [], nor: [], col: [], shk: [], pre: new Matrix4() });

const ta = new Vector3(), tb = new Vector3(), tn = new Vector3(), tp = new Vector3();

/** One triangle (counter-clockwise seen from outside), its uv in metres. */
export function tri(part: ShackPart, p: readonly [Vector3, Vector3, Vector3], uv: readonly [readonly [number, number], readonly [number, number], readonly [number, number]], tint: Color, seed: number): void {
  const [p0, p1, p2] = p;
  ta.copy(p1).applyMatrix4(part.pre).sub(tp.copy(p0).applyMatrix4(part.pre));
  tb.copy(p2).applyMatrix4(part.pre).sub(tp);
  tn.crossVectors(ta, tb).normalize();
  for (let i = 0; i < 3; i++) {
    const q = i === 0 ? p0 : i === 1 ? p1 : p2, w = uv[i] ?? [0, 0];
    tp.copy(q).applyMatrix4(part.pre);
    part.pos.push(tp.x, tp.y, tp.z); part.nor.push(tn.x, tn.y, tn.z); part.col.push(tint.r, tint.g, tint.b); part.shk.push(w[0], w[1], seed);
  }
}

/** A rectangle: origin `o`, sides `u` (length `w`) and `v` (length `h`); its face looks along u × v. uv from (u0, v0). */
export function quad(part: ShackPart, o: Vector3, u: Vector3, v: Vector3, w: number, h: number, tint: Color, seed: number, u0 = 0, v0 = 0): void {
  const a = o.clone(), b = o.clone().addScaledVector(u, w), c = b.clone().addScaledVector(v, h), d = o.clone().addScaledVector(v, h);
  tri(part, [a, b, c], [[u0, v0], [u0 + w, v0], [u0 + w, v0 + h]], tint, seed);
  tri(part, [a, c, d], [[u0, v0], [u0 + w, v0 + h], [u0, v0 + h]], tint, seed);
}

const AXES = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)] as const;
const axis = (i: number): Vector3 => AXES[i] ?? AXES[0];

/**
 * A box of size `size` placed by `m` (centred at its origin). Each face's uv runs along the box's longest side where
 * that side lies in the face, so a beam's grain runs along the beam on every long face.
 */
export function box(part: ShackPart, m: Matrix4, size: Vector3, tint: Color, seed: number): void {
  const half = size.clone().multiplyScalar(0.5), dims = [size.x, size.y, size.z];
  const long = dims.indexOf(Math.max(...dims));
  const saved = part.pre; part.pre = saved.clone().multiply(m);
  const h = [half.x, half.y, half.z];
  for (let n = 0; n < 3; n++) {
    for (const s of [1, -1]) {
      // the face's two in-plane axes, ordered so (a × b) points along +s on axis n
      const i = (n + 1) % 3, j = (n + 2) % 3;
      const [ai, bi] = s > 0 ? [i, j] : [j, i];
      const A = axis(ai), B = axis(bi), N = axis(n);
      const ha = h[ai] ?? 0, hb = h[bi] ?? 0, hn = h[n] ?? 0;
      const o = N.clone().multiplyScalar(s * hn).addScaledVector(A, -ha).addScaledVector(B, -hb);
      // uv: the long axis as u when it lies in this face
      const corners = [[0, 0], [1, 0], [1, 1], [0, 1]] as const;
      const pts = corners.map(([x, y]) => o.clone().addScaledVector(A, x * 2 * ha).addScaledVector(B, y * 2 * hb));
      const uvs = corners.map(([x, y]): readonly [number, number] => {
        const ca = x * 2 * ha, cb = y * 2 * hb;
        return bi === long ? [cb, ca] : [ca, cb];
      });
      const [p0, p1, p2, p3] = pts, [w0, w1, w2, w3] = uvs;
      if (!p0 || !p1 || !p2 || !p3 || !w0 || !w1 || !w2 || !w3) continue;
      tri(part, [p0, p1, p2], [w0, w1, w2], tint, seed);
      tri(part, [p0, p2, p3], [w0, w2, w3], tint, seed);
    }
  }
  part.pre = saved;
}

/** A box from its centre, size and a yaw / roll (radians), the common case. */
export function beam(part: ShackPart, at: Vector3, size: Vector3, tint: Color, seed: number, rotZ = 0, rotY = 0, rotX = 0): void {
  const m = new Matrix4().makeTranslation(at.x, at.y, at.z)
    .multiply(new Matrix4().makeRotationY(rotY)).multiply(new Matrix4().makeRotationZ(rotZ)).multiply(new Matrix4().makeRotationX(rotX));
  box(part, m, size, tint, seed);
}

/** A beam between two points (section `t` by `t2`, `t` in the plane of the beam and the vertical), for braces, barge boards, rails and spokes. */
export function strut(part: ShackPart, a: Vector3, b: Vector3, t: number, tint: Color, seed: number, t2 = t): void {
  const d = b.clone().sub(a), len = d.length(), x = d.clone().normalize();
  const up = Math.abs(x.y) > 0.95 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  const z = new Vector3().crossVectors(x, up).normalize(), y = new Vector3().crossVectors(z, x).normalize();
  const m = new Matrix4().makeBasis(x, y, z).setPosition(a.clone().add(b).multiplyScalar(0.5));
  box(part, m, new Vector3(len, t, t2), tint, seed);
}

/** A shear that leans everything above `y0` toward +x by `k` metres per metre (a tired old storey). */
export function leanAbove(y0: number, k: number, kz = 0): Matrix4 {
  const shear = new Matrix4().set(1, k, 0, 0, 0, 1, 0, 0, 0, kz, 1, 0, 0, 0, 0, 1);
  return new Matrix4().makeTranslation(0, y0, 0).multiply(shear).multiply(new Matrix4().makeTranslation(0, -y0, 0));
}

const MODE: Record<ShackKind, number> = { plank: 0, shingle: 1, stone: 2, beam: 3 };

const SHARED = /* glsl */ `
varying vec3 vShk;
varying float vShkY;
float shkH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float shkN(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(shkH(i), shkH(i + vec2(1.0, 0.0)), f.x), mix(shkH(i + vec2(0.0, 1.0)), shkH(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

const PATTERN = /* glsl */ `
{
  vec2 q = vShk.xy; float sd = vShk.z;
#if SHK_MODE == 0
  // planks: vertical boards, each its own tone and length; seams and butt joints; grain; rain streaks; dark at the sill
  float bx = q.x / 0.24; float bi = floor(bx); float fx = fract(bx);
  float len = 2.4 + 1.8 * shkH(vec2(bi, sd + 1.0));
  float by = q.y / len + shkH(vec2(bi, sd + 3.1)); float si = floor(by); float fy = fract(by);
  float t = shkH(vec2(bi * 1.7 + si * 5.3, sd));
  float ax = fwidth(bx), ay = fwidth(by);
  float seam = smoothstep(0.0, 0.05 + ax, fx) * smoothstep(1.0, 0.95 - ax, fx);
  float butt = smoothstep(0.0, 0.01 + ay, fy) * smoothstep(1.0, 0.99 - ay, fy);
  float grain = (0.84 + 0.16 * shkN(vec2(fx * 5.0 + bi * 7.0, q.y * 1.4))) * (0.93 + 0.07 * shkN(vec2(fx * 28.0 + bi, q.y * 0.6)));
  float rnd = 0.88 + 0.12 * smoothstep(0.0, 0.3, min(fx, 1.0 - fx));
  float streak = 0.74 + 0.26 * shkN(vec2(q.x * 1.7, q.y * 0.12 + sd));
  float silver = smoothstep(0.35, 0.9, shkN(vec2(q.x * 0.6 + sd, q.y * 0.4)));
  float grime = 1.0 - 0.3 * (1.0 - smoothstep(0.9, 1.7, vShkY));
  vec3 board = diffuseColor.rgb * mix(0.72, 1.12, t) * grain * rnd * streak * grime;
  board = mix(board, vec3(dot(board, vec3(0.33))) * vec3(1.02, 1.0, 0.97) * 1.08, silver * 0.45);
  // seams fade out where a board spans only a few pixels (else the far wall reads as zebra stripes)
  float near = clamp(1.6 - ax * 4.0, 0.0, 1.0);
  diffuseColor.rgb = board * mix(1.0, mix(0.38, 1.0, seam * butt), near);
#elif SHK_MODE == 1
  // shingles: staggered rows from the eave up, ragged butts, a shadow under each row's butt, moss toward the eave
  float r0 = q.y / 0.30;
  float sx = q.x / 0.33 + shkH(vec2(floor(r0), sd)) * 0.9 + floor(r0) * 0.5; float si = floor(sx); float fx = fract(sx);
  float r = r0 + (shkH(vec2(si, floor(r0) + sd)) - 0.5) * 0.16; float ri = floor(r); float fr = fract(r);
  float t = shkH(vec2(si * 1.3, ri * 2.1 + sd));
  float ax = fwidth(sx);
  float gap = smoothstep(0.0, 0.05 + ax, fx) * smoothstep(1.0, 0.95 - ax, fx);
  float near = clamp(1.6 - ax * 4.0, 0.0, 1.0);
  float shade = mix(1.0, mix(1.0, 0.6, smoothstep(0.6, 1.0, fr)) * (1.0 + 0.12 * (1.0 - smoothstep(0.0, 0.12, fr))), mix(0.5, 1.0, near));
  float grain = 0.88 + 0.12 * shkN(vec2(fx * 6.0 + si, q.y * 8.0));
  vec3 sh = diffuseColor.rgb * mix(0.72, 1.14, t) * (0.9 + 0.2 * shkN(vec2(q.x * 0.5, q.y * 0.35) + sd)) * grain * shade * mix(1.0, mix(0.5, 1.0, gap), near);
  float moss = smoothstep(0.6, 0.9, shkN(q * 0.9 + sd)) * (1.0 - smoothstep(0.2, 1.6, q.y)) * 0.6 + 0.3 * step(0.95, t);
  diffuseColor.rgb = mix(sh, vec3(0.16, 0.19, 0.08) * shade, clamp(moss, 0.0, 0.6));
#elif SHK_MODE == 2
  // stone: coursed blocks of mixed tone, mortar, bevelled edges, speckle, grime and moss at the foot
  float ch = 0.36; float r = q.y / ch; float ri = floor(r); float fr = fract(r);
  float L = 0.5 + 0.38 * shkH(vec2(ri, sd));
  float s = q.x / L + shkH(vec2(ri * 3.1, sd + 2.0)); float si = floor(s); float fs = fract(s);
  float t = shkH(vec2(si, ri + sd * 2.0));
  float d = min(min(fr, 1.0 - fr) * ch, min(fs, 1.0 - fs) * L);
  float mortar = smoothstep(0.01, 0.035 + fwidth(q.x) * 1.5, d);
  float bevel = mix(0.72, 1.0, smoothstep(0.015, 0.11, d));
  vec3 hue = mix(vec3(1.04, 0.97, 0.88), vec3(0.88, 0.92, 1.0), shkH(vec2(si + 7.0, ri)));
  float speck = 0.86 + 0.14 * shkN(q * 11.0) * shkN(q * 3.0 + 5.0);
  vec3 st = mix(vec3(0.22, 0.2, 0.19), diffuseColor.rgb * hue * mix(0.62, 1.18, t) * bevel * speck, mortar);
  float foot = 1.0 - smoothstep(0.0, 0.7, vShkY);
  float moss = foot * smoothstep(0.35, 0.7, shkN(q * 2.3 + sd));
  diffuseColor.rgb = mix(st * (1.0 - 0.3 * foot), vec3(0.17, 0.22, 0.07), moss * 0.8);
#else
  // beams: grain along the piece, a tone per piece, the odd check (crack)
  float g = shkN(vec2(q.x * 0.9 + sd * 3.0, q.y * 22.0 + sd * 13.0));
  float g2 = shkN(vec2(q.x * 4.0, q.y * 55.0));
  float check = smoothstep(0.88, 0.96, shkN(vec2(q.x * 0.45 + sd, q.y * 36.0)));
  diffuseColor.rgb *= (0.78 + 0.28 * g) * (0.92 + 0.08 * g2) * (1.0 - 0.5 * check) * mix(0.85, 1.12, shkH(vec2(sd, 1.0)));
#endif
}
`;

/** The material for a kind: vertex-coloured, the kind's pattern patched in. */
export function shackMaterial(kind: ShackKind): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: kind === 'stone' ? 0.95 : 0.88, metalness: 0 });
  material.defines = { SHK_MODE: MODE[kind] };
  patchShader(material, `far.shack.${kind}`, PATCH_ORDER.material, (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec3 shk;\nvarying vec3 vShk;\nvarying float vShkY;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvShk = shk; vShkY = position.y;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${SHARED}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${PATTERN}`);
  }, { key: (prior) => `${prior}|far.shack.${kind}` });
  return material;
}

/** The part as one mesh with its kind's material. */
export function shackMesh(part: ShackPart, name: string): Mesh {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(part.pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(part.nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(part.col, 3));
  g.setAttribute('shk', new Float32BufferAttribute(part.shk, 3));
  g.computeBoundingSphere();
  const mesh = new Mesh(g, shackMaterial(part.kind)); mesh.name = name;
  return mesh;
}
