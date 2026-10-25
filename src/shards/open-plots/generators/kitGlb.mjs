// RM3: owned, in-memory exports of today's kit builders. Publication and placement belong to the plot producer.
import { BufferGeometry, Float32BufferAttribute, MeshStandardMaterial } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { lanternPiece } from './kit.mjs';

/** Export the existing post, glow, pool and collision triangles without changing their vertex colours.
 * Palette slots are named materials with a neutral factor; the three visual parts keep their existing shader roles.
 * No filesystem access, placement, light bake or moving-light seed is performed here. */
export function lanternGlb(palette, height = 2.8) {
  const parts = lanternPiece(palette, height);
  const primitives = [];
  try {
    for (const [source, partName, name, slot] of [
      ['Kit', 'Kit', 'lantern_post', 'wood'], ['Glow', 'Glow', 'lantern_glow', 'lantern'],
      ['Pool', 'Pool', 'lantern_pool', 'pool'], ['solid', 'Solid', 'collide_post', 'collision'],
    ]) {
      const part = parts[source].part(partName);
      const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(part.positions, 3));
      const material = new MeshStandardMaterial({ roughness: source === 'Kit' ? 0.9 : 1, metalness: 0 });
      material.name = slot;
      primitives.push({ name, geometry, material, compactIndex: true });
      if (source !== 'solid') geometry.setAttribute('color', new Float32BufferAttribute(part.colours, 3));
      if (source === 'Kit' || source === 'Glow') geometry.setAttribute('normal', new Float32BufferAttribute(part.normals, 3));
    }
    return staticGlb(primitives, 'lantern');
  } finally {
    for (const { geometry, material } of primitives) { geometry.dispose(); material.dispose(); }
  }
}
