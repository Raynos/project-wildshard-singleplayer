import * as THREE from 'three';
import { staticGlb, type GlbPrimitive } from '@wildshard/sdk/bake/glb';
import { SPRUCE_SPECS, spruceGeometry } from './spruceGeometry';

/** The spruce rest pool's product name: the tree set loads it through `product.url` (GR6; it was a hashed public GLB). */
export const SPRUCE_POOL_NAME = 'models/trees/spruce.glb';
/** the tree set's part names → the spruce's LOD buffers (no lo trunk: the far band reuses the trunk) */
const SPRUCE_PARTS = { trunk: 'trunk', hi: 'cardsHi', lo: 'cardsLo', twigs: 'twigs', far: 'far' } as const;

/** The pool's rows as the tree set and the map read them: its product name, its part names in pool order and each
 *  variant's height and trunk (the authored SPRUCE_SPECS, which the geometry is built from). */
export const SPRUCE_REST: { readonly geometry: string; readonly parts: readonly string[]; readonly variants: readonly { readonly height: number; readonly trunk: number }[] } = {
  geometry: SPRUCE_POOL_NAME,
  parts: SPRUCE_SPECS.flatMap((_spec, i) => Object.keys(SPRUCE_PARTS).map(part => `spruce-${String(i)}__${part}`)),
  variants: SPRUCE_SPECS.map(spec => ({ height: spec.height, trunk: spec.trunk })),
};

/** GR6: the spruce's crown and trunk buffers as one rest-geometry pool GLB at build time (the retired nalati-spruce job's
 *  bytes), read by the game's tree set (the world/trees section) and the map. */
export function nalatiSprucePool(): Uint8Array {
  const neutral = new THREE.MeshStandardMaterial();
  const primitives = spruceGeometry().flatMap((variant, i) => Object.entries(SPRUCE_PARTS).map(([part, key]): GlbPrimitive & { geometry: THREE.BufferGeometry } => {
    const geometry = variant[key]; geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const box = geometry.boundingBox, sphere = geometry.boundingSphere;
    if (box === null || sphere === null) throw new Error('Spruce pool requires bounds');
    return { name: `spruce-${String(i)}__${part}`, geometry, material: neutral, compactIndex: true,
      extras: { restGroups: [], restBox: [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z],
        restSphere: [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius] } };
  }));
  try { return staticGlb(primitives, 'nalati-spruce'); } finally {
    for (const row of primitives) row.geometry.dispose();
    neutral.dispose();
  }
}
