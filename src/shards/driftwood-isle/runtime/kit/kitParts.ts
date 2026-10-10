import * as THREE from 'three';
import { log, plank, rock, rope } from '@wildshard/engine/world/geometryKit';
import { LowPolyKit } from '@wildshard/engine/world/lowpolyKit';

/**
 * A low-poly kit mesh as rows (SHARD-PLATFORM M3, look-family rows): one flat-shaded, vertex-coloured geometry built by
 * the engine's LowPolyKit from a list of primitive parts in add order (boxes, icosahedra, cones, cylinders, tori, sphere
 * caps, tapered logs, ropes, rocks, planks), each with its colour, an optional pre-transform of the primitive, a placement
 * (`at`: position, Euler (rx, ry, rz) and scale; or a whole matrix) and the kit's options (wobble, jitter, sway). The
 * kit's rng stream runs through the parts in order, so the same rows always build the same bytes. A part marked `rel`
 * is placed off the build's origin (a campfire beside its keeper). Nothing here knows a shard: the rows are its `data/`.
 *
 *   const geometry = buildKitMesh(row);                 // or buildKitMesh(row, fireLocal) for `rel` parts
 *   const mesh = new THREE.Mesh(geometry, lowPolyMaterial(sky));
 */

/** A primitive's kind; `args` are the constructor's (`log`: a, b, r0, r1, sides, twist; `rope`: r then the points
 *  flattened; `rock`: r, detail, squash, rough; `plank`: length, width, thickness, wobble), the kit's rng implied. */
export type KitPartKind = 'box' | 'icosa' | 'cone' | 'cylinder' | 'torus' | 'sphere' | 'log' | 'rope' | 'rock' | 'plank';

/** One part of a kit mesh as data. */
export interface KitPartRow {
  readonly kind: KitPartKind;
  readonly args: readonly number[];
  /** its colour (any CSS colour three parses) */
  readonly color: string;
  /** transforms applied to the primitive first, in order: ['rotateX' | 'rotateY' | 'rotateZ', rad] or ['translate', x, y, z] */
  readonly pre?: readonly (readonly [string, ...number[]])[];
  /** where: [x, y, z, ry, rx, rz, sx, sy, sz] (trailing defaults 0 / 1 may be left off); or `matrix` (16, column-major) */
  readonly at?: readonly number[];
  readonly matrix?: readonly number[];
  /** the kit's per-vertex wobble (m), per-face jitter and wind sway */
  readonly wobble?: number;
  readonly jitter?: number;
  readonly sway?: { readonly w: number; readonly phase?: number; readonly hang?: boolean };
  /** placed off the build's origin (its position, or a log's two ends) */
  readonly rel?: boolean;
}

/** A kit mesh as data: the kit's seed, its finish (baked ambient occlusion or none) and its parts in add order. */
export interface KitMeshRow {
  readonly seed: number;
  readonly ao: { readonly floorY: number; readonly strength: number } | false;
  readonly parts: readonly KitPartRow[];
}

const num = (a: readonly number[], i: number, fallback: number): number => a[i] ?? fallback;

function primitive(p: KitPartRow, kit: LowPolyKit, o: THREE.Vector3 | null): THREE.BufferGeometry {
  const a = p.args, n = (i: number): number => num(a, i, 0);
  switch (p.kind) {
    case 'box': return new THREE.BoxGeometry(n(0), n(1), n(2));
    case 'icosa': return new THREE.IcosahedronGeometry(n(0), n(1));
    case 'cone': return new THREE.ConeGeometry(n(0), n(1), n(2));
    case 'cylinder': return new THREE.CylinderGeometry(n(0), n(1), n(2), n(3));
    case 'torus': return new THREE.TorusGeometry(n(0), n(1), n(2), n(3));
    case 'sphere': return new THREE.SphereGeometry(n(0), n(1), n(2), n(3), n(4), n(5), n(6));
    case 'log': {
      const ox = o?.x ?? 0, oy = o?.y ?? 0, oz = o?.z ?? 0;
      const end = (i: number): THREE.Vector3 => o === null ? new THREE.Vector3(n(i), n(i + 1), n(i + 2)) : new THREE.Vector3(ox + n(i), oy + n(i + 1), oz + n(i + 2));
      return log(end(0), end(3), n(6), num(a, 7, n(6)), num(a, 8, 6), n(9));
    }
    case 'rope': {
      const pts: THREE.Vector3[] = [];
      for (let i = 1; i + 2 < a.length; i += 3) pts.push(new THREE.Vector3(n(i), n(i + 1), n(i + 2)));
      return rope(pts, n(0));
    }
    case 'rock': return rock(n(0), n(1), kit.rng, num(a, 2, 0.7), num(a, 3, 0.28));
    case 'plank': return plank(n(0), n(1), n(2), kit.rng, num(a, 3, 0.012));
    default: throw new Error(`kitParts: unknown part kind ${String(p.kind)}`);
  }
}

function preTransform(g: THREE.BufferGeometry, ops: KitPartRow['pre']): void {
  for (const [op, x = 0, y = 0, z = 0] of ops ?? []) {
    if (op === 'rotateX') g.rotateX(x);
    else if (op === 'rotateY') g.rotateY(x);
    else if (op === 'rotateZ') g.rotateZ(x);
    else if (op === 'translate') g.translate(x, y, z);
  }
}

function placement(p: KitPartRow, o: THREE.Vector3 | null): THREE.Matrix4 | undefined {
  if (p.matrix !== undefined) return new THREE.Matrix4().fromArray(p.matrix);
  const at = p.at;
  if (at === undefined) return undefined;
  const v = (i: number, fallback: number): number => num(at, i, fallback);
  const pos = o !== null && p.rel === true ? new THREE.Vector3(o.x + v(0, 0), o.y + v(1, 0), o.z + v(2, 0)) : new THREE.Vector3(v(0, 0), v(1, 0), v(2, 0));
  return new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(v(4, 0), v(3, 0), v(5, 0))), new THREE.Vector3(v(6, 1), v(7, 1), v(8, 1)));
}

/** Builds a kit mesh's geometry from its row; `origin` places the parts marked `rel`. */
export function buildKitMesh(row: KitMeshRow, origin: THREE.Vector3 | null = null): THREE.BufferGeometry {
  const kit = new LowPolyKit(row.seed);
  for (const p of row.parts) {
    const rel = p.rel === true ? origin : null;
    const g = primitive(p, kit, rel);
    preTransform(g, p.pre);
    const matrix = placement(p, origin);
    kit.add(g, p.color, {
      ...(matrix === undefined ? {} : { matrix }),
      ...(p.wobble === undefined ? {} : { wobble: p.wobble }),
      ...(p.jitter === undefined ? {} : { jitter: p.jitter }),
      ...(p.sway === undefined ? {} : { sway: { ...p.sway } }),
    });
  }
  return kit.finish({ ao: row.ao === false ? false : { ...row.ao } });
}
