import { BoxGeometry, CapsuleGeometry, ConeGeometry, CylinderGeometry, ExtrudeGeometry, IcosahedronGeometry, Shape, SphereGeometry,
  TorusGeometry, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** GR8 (D62): the game's primitive builders (src/game/plugin/geometry.ts `buildPrimitive` / `mergePrimitives`), copied for
 *  the King kit so Pine's program never bundles that runtime module (its lazy product import made a second config chunk).
 *  Same three.js calls in the same order, so the same vertices. */
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

/** A primitive's kind; `args` are its three.js constructor's, in order (a cylinder's sixth, open-ended, is 1 for true); an
 *  `extrude` is its row's `shape` extruded by its `extrude` options. */
export type PrimitiveKind = 'box' | 'cylinder' | 'cone' | 'sphere' | 'torus' | 'icosahedron' | 'capsule' | 'extrude';

/** One transform, applied by the geometry's own method (`rotateX` … angles in radians). */
export type PrimitiveOp = readonly ['translate' | 'scale', number, number, number] | readonly ['rotateX' | 'rotateY' | 'rotateZ', number];

/** One step of a 2D outline (three's Shape path methods, in order). */
export type ShapeStep = readonly ['moveTo' | 'lineTo', number, number] | readonly ['quadraticCurveTo', number, number, number, number];
/** An outline's extrusion (three's ExtrudeGeometry options). */
export interface ExtrudeRow {
  readonly depth: number; readonly bevelEnabled: boolean; readonly bevelThickness: number; readonly bevelSize: number;
  readonly bevelSegments: number; readonly curveSegments: number;
}
/** One primitive as data. */
export interface PrimitiveRow {
  readonly kind: PrimitiveKind;
  readonly args: readonly number[];
  /** an `extrude`'s outline and options */
  readonly shape?: readonly ShapeStep[];
  readonly extrude?: ExtrudeRow;
  /** applied in order */
  readonly ops?: readonly PrimitiveOp[];
}


const arg = (a: readonly number[], i: number): number | undefined => a[i];

function primitive(p: PrimitiveRow): BufferGeometry {
  const a = p.args;
  switch (p.kind) {
    case 'box': return new BoxGeometry(arg(a, 0), arg(a, 1), arg(a, 2));
    case 'cylinder': return new CylinderGeometry(arg(a, 0), arg(a, 1), arg(a, 2), arg(a, 3), arg(a, 4), arg(a, 5) === 1);
    case 'cone': return new ConeGeometry(arg(a, 0), arg(a, 1), arg(a, 2));
    case 'sphere': return new SphereGeometry(arg(a, 0), arg(a, 1), arg(a, 2));
    case 'torus': return new TorusGeometry(arg(a, 0), arg(a, 1), arg(a, 2), arg(a, 3), arg(a, 4));
    case 'icosahedron': return new IcosahedronGeometry(arg(a, 0), arg(a, 1));
    case 'capsule': return new CapsuleGeometry(arg(a, 0), arg(a, 1), arg(a, 2), arg(a, 3));
    case 'extrude': return extruded(p);
    default: {
      const unknown: never = p.kind;
      throw new Error(`unknown primitive ${String(unknown)}`);
    }
  }
}

/** an `extrude` row's outline, extruded */
function extruded(p: PrimitiveRow): BufferGeometry {
  if (p.shape === undefined || p.extrude === undefined) throw new Error('an extrude primitive needs a shape and its options');
  const s = new Shape();
  for (const step of p.shape) {
    if (step[0] === 'quadraticCurveTo') s.quadraticCurveTo(step[1], step[2], step[3], step[4]);
    else if (step[0] === 'moveTo') s.moveTo(step[1], step[2]);
    else s.lineTo(step[1], step[2]);
  }
  const e = p.extrude;
  return new ExtrudeGeometry(s, { depth: e.depth, bevelEnabled: e.bevelEnabled, bevelThickness: e.bevelThickness, bevelSize: e.bevelSize, bevelSegments: e.bevelSegments, curveSegments: e.curveSegments });
}
/** One primitive with its transforms applied in order (indexed as three.js builds it). */
export function buildPrimitive(row: PrimitiveRow): BufferGeometry {
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

const merged = (parts: BufferGeometry[]): BufferGeometry => mergeGeometries(parts, false);
/** The rows built (`buildPrimitive`), each made non-indexed, merged in order into one geometry (no groups). */
export function mergePrimitives(rows: readonly PrimitiveRow[]): BufferGeometry {
  return merged(rows.map((r) => buildPrimitive(r).toNonIndexed()));
}
