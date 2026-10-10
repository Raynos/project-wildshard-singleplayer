import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * A smooth-shaded figure from primitive parts (SHARD-PLATFORM M3, moved from Pine Hollow's models/people.ts): every part
 * a three.js primitive placed by a position, an Euler (rx, ry, rz) and a scale, made non-indexed, its uvs dropped, its
 * normals recomputed and its vertices painted one colour, then all merged in add order into one position + normal +
 * colour geometry (one draw on a vertex-coloured material). `PartKit` takes built geometries; `buildPrimitiveParts`
 * takes the parts as rows (a shard's `data/`), so a stand-in person, a trolley or a canoe is data.
 *
 *   const geometry = buildPrimitiveParts(rows);
 *   const mesh = new THREE.Mesh(geometry, vertexColouredMaterial);
 */

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();

/** A part list builder: every part non-indexed with position + normal + colour, merged in add order. */
export class PartKit {
  private parts: THREE.BufferGeometry[] = [];
  /** add `g` painted `color` (a CSS colour, or a Color copied as it stands), placed at (x, y, z), turned (rx, ry, rz), scaled (sx, sy, sz) */
  add(g: THREE.BufferGeometry, color: string | THREE.Color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): this {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    const geo = (g.index ? g.toNonIndexed() : g).applyMatrix4(_m);
    if (geo.hasAttribute('uv')) geo.deleteAttribute('uv');
    if (geo.hasAttribute('uv1')) geo.deleteAttribute('uv1');
    geo.computeVertexNormals();
    const n = geo.getAttribute('position').count, col = new Float32Array(n * 3);
    if (typeof color === 'string') _c.set(color); else _c.copy(color);
    for (let i = 0; i < n; i++) col.set([_c.r, _c.g, _c.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.parts.push(geo);
    return this;
  }
  /** the merged geometry (the parts disposed, the kit emptied) */
  finish(): THREE.BufferGeometry {
    const g = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts = [];
    g.computeBoundingSphere();
    return g;
  }
}

/** A primitive's kind; `args` are its three.js constructor's, in order (`cylinder`: radiusTop, radiusBottom, height,
 *  radialSegments, heightSegments; `sphere`: radius, widthSegments, heightSegments, phiStart, phiLength, thetaStart,
 *  thetaLength; `cone`: radius, height, radialSegments; `box`: width, height, depth; `torus`: radius, tube,
 *  radialSegments, tubularSegments). */
export type PrimitivePartKind = 'box' | 'cylinder' | 'sphere' | 'cone' | 'torus';

/** One part as data. */
export interface PrimitivePartRow {
  readonly kind: PrimitivePartKind;
  readonly args: readonly number[];
  /** a cylinder left open at its ends */
  readonly open?: boolean;
  /** a CSS colour three parses, or a working-space (r, g, b) taken as it stands (an over-bright glow) */
  readonly color: string | readonly [number, number, number];
  /** where: [x, y, z, rx, ry, rz, sx, sy, sz] (trailing defaults 0 / 1 may be left off) */
  readonly at?: readonly number[];
}

const arg = (a: readonly number[], i: number): number | undefined => a[i];

function primitive(p: PrimitivePartRow): THREE.BufferGeometry {
  const a = p.args;
  switch (p.kind) {
    case 'box': return new THREE.BoxGeometry(arg(a, 0), arg(a, 1), arg(a, 2));
    case 'cylinder': return new THREE.CylinderGeometry(arg(a, 0), arg(a, 1), arg(a, 2), arg(a, 3), arg(a, 4), p.open);
    case 'sphere': return new THREE.SphereGeometry(arg(a, 0), arg(a, 1), arg(a, 2), arg(a, 3), arg(a, 4), arg(a, 5), arg(a, 6));
    case 'cone': return new THREE.ConeGeometry(arg(a, 0), arg(a, 1), arg(a, 2));
    case 'torus': return new THREE.TorusGeometry(arg(a, 0), arg(a, 1), arg(a, 2), arg(a, 3));
    default: {
      const unknown: never = p.kind;
      throw new Error(`unknown primitive part ${String(unknown)}`);
    }
  }
}

/** Build the parts (rows, in add order) into one merged position + normal + colour geometry. */
export function buildPrimitiveParts(rows: readonly PrimitivePartRow[]): THREE.BufferGeometry {
  const k = new PartKit();
  for (const p of rows) {
    const at = p.at ?? [], n = (i: number, d: number): number => at[i] ?? d;
    const color = typeof p.color === 'string' ? p.color : new THREE.Color(p.color[0], p.color[1], p.color[2]);
    k.add(primitive(p), color, n(0, 0), n(1, 0), n(2, 0), n(3, 0), n(4, 0), n(5, 0), n(6, 1), n(7, 1), n(8, 1));
  }
  return k.finish();
}
