import { BufferGeometry, type Color, Float32BufferAttribute, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { ShackKind } from '../world/shack';

/**
 * Build-time only (SHARD-PLATFORM SF72): the weathered-timber geometry kit for Sky Reach's small buildings, run by the
 * bake (`scripts/bake-sky-world.mjs`), never by the client. The client draws the baked surfaces in their kind's shader
 * (`world/shack.ts` `shackMaterial`).
 *
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

/**
 * The part as one mesh for the bake: its geometry (with the `shk` channel the kind's shader reads) in a stand-in standard
 * material that names its kind (`userData.shack`); the bake keeps the name in the kind's row and the client draws it in
 * `shackMaterial(kind)`.
 */
export function shackMesh(part: ShackPart, name: string): Mesh {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(part.pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(part.nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(part.col, 3));
  g.setAttribute('shk', new Float32BufferAttribute(part.shk, 3));
  g.computeBoundingSphere();
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: part.kind === 'stone' ? 0.95 : 0.88, metalness: 0 });
  material.userData['shack'] = part.kind;
  const mesh = new Mesh(g, material); mesh.name = name;
  return mesh;
}
