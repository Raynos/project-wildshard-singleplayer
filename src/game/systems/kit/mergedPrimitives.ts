import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Primitives as rows (SHARD-PLATFORM M3): a three.js primitive, the transforms applied to it in order (translate,
 * rotate about an axis, scale: the geometry's own methods, so every vertex is the one hand-written code computed), and
 * whether it is made non-indexed; a list of them merged in order into one geometry that keeps every part's attributes
 * (position, normal, uv). A lantern's iron frame, a ribcage's hoops or a skull plate is data; `standardMaterial` makes a
 * MeshStandardMaterial from a row (hex or working-space colours). Unlike `primitiveParts` (one colour per part, normals
 * recomputed) the parts keep their own normals and uvs.
 *
 *   const frame = mergePrimitives(rows);           // every row non-indexed, merged
 *   const glass = buildPrimitive(row);             // one part as it stands
 */

/** A primitive's kind; `args` are its three.js constructor's, in order. */
export type PrimitiveKind = 'box' | 'cylinder' | 'cone' | 'sphere' | 'torus' | 'icosahedron';

/** One transform, applied by the geometry's own method (`rotateX` … angles in radians). */
export type PrimitiveOp = readonly ['translate' | 'scale', number, number, number] | readonly ['rotateX' | 'rotateY' | 'rotateZ', number];

/** One primitive as data. */
export interface PrimitiveRow {
  readonly kind: PrimitiveKind;
  readonly args: readonly number[];
  /** applied in order */
  readonly ops?: readonly PrimitiveOp[];
}

/** A MeshStandardMaterial as data: colours a hex number or working-space (r, g, b). */
export interface StandardMaterialRow {
  readonly color: number | readonly [number, number, number];
  readonly emissive?: number | readonly [number, number, number];
  readonly emissiveIntensity?: number;
  readonly roughness: number;
  readonly metalness: number;
  readonly fog?: boolean;
}

const arg = (a: readonly number[], i: number): number | undefined => a[i];

function primitive(p: PrimitiveRow): THREE.BufferGeometry {
  const a = p.args;
  switch (p.kind) {
    case 'box': return new THREE.BoxGeometry(arg(a, 0), arg(a, 1), arg(a, 2));
    case 'cylinder': return new THREE.CylinderGeometry(arg(a, 0), arg(a, 1), arg(a, 2), arg(a, 3));
    case 'cone': return new THREE.ConeGeometry(arg(a, 0), arg(a, 1), arg(a, 2));
    case 'sphere': return new THREE.SphereGeometry(arg(a, 0), arg(a, 1), arg(a, 2));
    case 'torus': return new THREE.TorusGeometry(arg(a, 0), arg(a, 1), arg(a, 2), arg(a, 3), arg(a, 4));
    case 'icosahedron': return new THREE.IcosahedronGeometry(arg(a, 0), arg(a, 1));
    default: {
      const unknown: never = p.kind;
      throw new Error(`unknown primitive ${String(unknown)}`);
    }
  }
}

/** One primitive with its transforms applied in order (indexed as three.js builds it). */
export function buildPrimitive(row: PrimitiveRow): THREE.BufferGeometry {
  const g = primitive(row);
  for (const op of row.ops ?? []) {
    if (op[0] === 'translate') g.translate(op[1], op[2], op[3]);
    else if (op[0] === 'scale') g.scale(op[1], op[2], op[3]);
    else if (op[0] === 'rotateX') g.rotateX(op[1]);
    else if (op[0] === 'rotateY') g.rotateY(op[1]);
    else g.rotateZ(op[1]);
  }
  return g;
}

/** The rows built (`buildPrimitive`), each made non-indexed, merged in order into one geometry (no groups). */
export function mergePrimitives(rows: readonly PrimitiveRow[]): THREE.BufferGeometry {
  return mergeGeometries(rows.map((r) => buildPrimitive(r).toNonIndexed()), false);
}

const colour = (c: number | readonly [number, number, number]): THREE.Color => (typeof c === 'number' ? new THREE.Color(c) : new THREE.Color(c[0], c[1], c[2]));

/** A MeshStandardMaterial from its row (fog left at three's default unless the row says). */
export function standardMaterial(row: StandardMaterialRow): THREE.MeshStandardMaterial {
  const p: THREE.MeshStandardMaterialParameters = { color: colour(row.color), roughness: row.roughness, metalness: row.metalness };
  if (row.emissive !== undefined) p.emissive = colour(row.emissive);
  if (row.emissiveIntensity !== undefined) p.emissiveIntensity = row.emissiveIntensity;
  if (row.fog !== undefined) p.fog = row.fog;
  return new THREE.MeshStandardMaterial(p);
}
