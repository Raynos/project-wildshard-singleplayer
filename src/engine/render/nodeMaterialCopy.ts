import type { Material } from 'three';

/**
 * Carry the accessor fields three's `NodeMaterial.copy` drops (D189).
 *
 * three r186's `NodeMaterial.copy` never calls `Material.copy`: it copies the setters of the most-derived prototype and
 * then the instance's own fields, skipping `_` fields. An accessor declared further up the chain (Material's `alphaTest`,
 * stored in `_alphaTest`) is therefore lost on every `clone()`, and a cut-out card cloned for a cell clip drew as an
 * opaque quad. Every node material class the engine makes calls this from its `copy()`, so no clone path can drop it.
 */
export function copyNodeMaterialAccessors(target: Material, source: Material): void {
  const most: unknown = Object.getPrototypeOf(target);
  for (let proto: unknown = typeof most === 'object' && most !== null ? Object.getPrototypeOf(most) : null; typeof proto === 'object' && proto !== null && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(proto))) {
      // a setter alone (`needsUpdate`) is a command, not a field
      if (descriptor.get === undefined || descriptor.set === undefined) continue;
      const value: unknown = Reflect.get(source, key);
      if (value !== undefined) Reflect.set(target, key, value);
    }
  }
}
