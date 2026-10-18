import { InstancedBufferGeometry, type BufferGeometry, type InstancedBufferAttribute } from 'three';

/**
 * `quad` (its index, position and uv shared, never copied) drawn once per instance: each named per-instance attribute set
 * as given, the instance count the first attribute's (0 without one). A card's baked rows go through it, and so does any
 * caller's own instanced quad cloud (a fire's smoke and sparks seeded per instance).
 */
export function instancedQuad(quad: BufferGeometry, attributes: Readonly<Record<string, InstancedBufferAttribute>>): InstancedBufferGeometry {
  const g = new InstancedBufferGeometry();
  g.index = quad.index; g.setAttribute('position', quad.getAttribute('position')); g.setAttribute('uv', quad.getAttribute('uv'));
  let count = -1;
  for (const [name, attribute] of Object.entries(attributes)) {
    if (count < 0) count = attribute.count;
    g.setAttribute(name, attribute);
  }
  g.instanceCount = Math.max(count, 0);
  return g;
}
