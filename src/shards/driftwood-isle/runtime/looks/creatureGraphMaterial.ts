import type * as THREE from 'three';
import type { MeshStandardNodeMaterial } from 'three/webgpu';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { lentLook, setLentParam } from '@wildshard/sdk/looks/lentLooks';

/** A creature-only composition receives its material identities without loading world layout data. */
export function creatureGraphMaterial(look: SpeciesLook, ids: { readonly body: string; readonly glowing: string }): SpeciesLook {
  const isLitGraph = (value: THREE.Material): value is MeshStandardNodeMaterial => Reflect.get(value, 'isMeshStandardNodeMaterial') === true;
  const material = (id: string): MeshStandardNodeMaterial => {
    const value: THREE.Material = lentLook(id);
    if (!isLitGraph(value)) throw new Error(`Creature graph is not lit: ${id}`);
    return value;
  };
  return { ...look, faceted: true, material: (_sky, glow, intensity = 1) => {
    if (glow === undefined) return material(ids.body).clone();
    setLentParam(ids.glowing, 'glow', [glow[0] * intensity, glow[1] * intensity, glow[2] * intensity]);
    return material(ids.glowing).clone();
  } };
}
