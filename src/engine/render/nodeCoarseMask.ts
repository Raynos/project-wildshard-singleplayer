/** Lazy node-backend port for the same coarse quadrant mask as the classic shader patch.
 * Installing the factory is explicit when the renderer loads its node handler; importing
 * this module never loads TSL or installs a rendering service. */
import type { Material, Uniform, Vector2, Vector4 } from 'three';

export type NodeCoarseMask = (material: Material, origin: Uniform<Vector2>, mask: Uniform<Vector4>, half: number) => boolean;
let apply: NodeCoarseMask | null = null;

/** The loaded node handler supplies its native mask expression. False means a classic material. */
export function installNodeCoarseMask(factory: NodeCoarseMask): void { apply = factory; }

/** Apply the loaded node backend's mask without importing it on the classic path. */
export function applyNodeCoarseMask(material: Material, origin: Uniform<Vector2>, mask: Uniform<Vector4>, half: number): boolean {
  return apply?.(material, origin, mask, half) ?? false;
}
