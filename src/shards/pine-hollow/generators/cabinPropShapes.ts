/** Original cabin scan parts merged once in their native frame, never on the page. */
import * as THREE from 'three';
import { mergeGeometries, deinterleaveGeometry } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BakedPiece } from '@wildshard/sdk/bake';

export const CABIN_PROP_SOURCES = { crate: 'wooden_crate_02', barrel: 'wine_barrel_01', bucket: 'wooden_bucket_01', hatchet: 'hatchet' } as const;
interface Shape { name: string; matrix: number[]; sphere: number[] }
function shapeGeometry(value: unknown): value is THREE.BufferGeometry { return value instanceof THREE.BufferGeometry; }
interface Part { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }
/** Preserve shipping merge order, matrices, attribute types and sphere; material bytes stay on their existing tier. */
export function pineCabinPropShapes(piece: BakedPiece, sources: Readonly<Record<keyof typeof CABIN_PROP_SOURCES, readonly Part[]>>): Record<keyof typeof CABIN_PROP_SOURCES, Shape> {
  const rows = {} as Record<keyof typeof CABIN_PROP_SOURCES, Shape>, material = new THREE.MeshStandardMaterial(); material.name = 'pine.props';
  for (const kind of Object.keys(CABIN_PROP_SOURCES) as (keyof typeof CABIN_PROP_SOURCES)[]) {
    const parts = sources[kind], first = parts[0]; if (first === undefined) throw new Error('Cabin scan omitted its original parts');
    const candidate: unknown = parts.length === 1 ? first.geometry : mergeGeometries(parts.map(part => part.geometry.clone().applyMatrix4(part.matrix)));
    if (!shapeGeometry(candidate)) throw new Error('Cabin scan attributes no longer merge');
    const geometry = candidate; deinterleaveGeometry(geometry); geometry.computeBoundingSphere();
    const sphere = geometry.boundingSphere; if (sphere === null) throw new Error('Cabin prop sphere missing');
    const name = `pine.cabin-prop.${kind}`, matrix = parts.length === 1 ? first.matrix : new THREE.Matrix4();
    const mesh = new THREE.InstancedMesh(geometry, material, 1); mesh.name = name; mesh.setMatrixAt(0, new THREE.Matrix4()); piece.add(mesh);
    rows[kind] = { name, matrix: [...matrix.elements], sphere: [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius] };
  }
  return rows;
}
