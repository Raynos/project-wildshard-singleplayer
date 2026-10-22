// The spruce's crown and trunk buffers as one rest-geometry pool GLB, read by the game's tree set (the world/trees section).
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import { spruceGeometry } from './spruceGeometry.ts';

const root = resolve(import.meta.dirname, '../../../..'), neutral = new THREE.MeshStandardMaterial();
/** the tree set's part names → the spruce's LOD buffers (no lo trunk: the far band reuses the trunk) */
const SPRUCE_PARTS = { trunk: 'trunk', hi: 'cardsHi', lo: 'cardsLo', twigs: 'twigs', far: 'far' };
const variants = spruceGeometry();
const primitives = variants.flatMap((v, i) => Object.entries(SPRUCE_PARTS).map(([part, key]) => {
  const geometry = v[key]; geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const box = geometry.boundingBox, sphere = geometry.boundingSphere;
  return { name: `spruce-${String(i)}__${part}`, geometry, material: neutral, compactIndex: true,
    extras: { restGroups: [], restBox: [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z],
      restSphere: [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius] } };
}));
const glb = staticGlb(primitives, 'nalati-spruce'), hash = createHash('sha256').update(glb).digest('hex');
const geometry = `/assets/nalati/baked/spruce-${hash}.glb`;
for (const row of primitives) row.geometry.dispose();
const writer = byteWriter(process.argv.includes('--check'), 'nalati-spruce');
writer.put(resolve(root, `public${geometry}`), glb);
for (const old of ['spruce.bin', 'spruce.json']) writer.remove(resolve(root, `public/assets/nalati/baked/${old}`));
writer.put(resolve(root, 'src/shards/nalati-grasslands/data/spruceRest.generated.json'), jsonBytes({ geometry, parts: primitives.map(row => row.name),
  variants: variants.map(v => ({ height: v.height, trunk: v.trunkRadius })) }));
writer.finish();
