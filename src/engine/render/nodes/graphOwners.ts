/**
 * Which graph compile made a material (js-payload J7). Kept apart from `nodeBuildReuse.ts`, which needs three's node
 * system at runtime: `graphBackend.ts`, the lazy door every shard imports, reads and writes these marks, so they must
 * not pull `three/webgpu` into a boot that never compiles a graph (the Template's).
 */
import type * as THREE from 'three';
import type { GraphNodeOwner } from './nodeBuildReuse';

const owners = new WeakMap<THREE.Material, GraphNodeOwner>();
/** `material` was compiled by `owner`'s compile (the graph compiler registers its materials) */
export function ownGraphNodes(material: THREE.Material, owner: GraphNodeOwner): void { owners.set(material, owner); }
/** the compile that made `material`'s graph (undefined: not a compiled graph, never reused) */
export function graphNodeOwner(material: THREE.Material): GraphNodeOwner | undefined { return owners.get(material); }
