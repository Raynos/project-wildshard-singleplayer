import { driftwoodRows } from '../boot/rows';
import type * as THREE from 'three';
import type { MeshStandardNodeMaterial } from 'three/webgpu';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { lentLook, setLentParam } from '@wildshard/sdk/looks/lentLooks';

/**
 * The island's creatures on their graph toon looks (data/creatureLook.ts): the runtime lends the compiled bodies before
 * the world builds (@wildshard/sdk/looks/lentLooks), and `graphCreatureLook` turns a species look into one whose `material`
 * is a copy of the body per animal (the factory tints its colour and flashes its emissive) on the faceted one-group body.
 * Each copy is the animal's port (`sharedBody`): the rigs draw one body per lent body, so the entry builds one graph per
 * skeleton, not one per animal (O15). There is no classic stand-in: a creature made before the bodies were lent refuses.
 */
const isLitGraph = (m: THREE.Material): m is MeshStandardNodeMaterial => Reflect.get(m, 'isMeshStandardNodeMaterial') === true;
/** a lent creature body (a lit graph); refuses before the lend or on another kind of look */
function body(id: string): MeshStandardNodeMaterial {
  const m = lentLook(id);
  if (!isLitGraph(m)) throw new Error(`Creature looks: ${id} is not a lit creature graph`);
  return m;
}

/** `look` drawn on its graph body: faceted, one copy of the body per animal. A species with an eye glow wears the glowing
 *  body, its glow the species' colour × intensity; the Drowned Captain always wears his own painted body (its coat the
 *  graph's admitted texture). */
export function graphCreatureLook(look: SpeciesLook): SpeciesLook {
  const name = (glow: unknown): string => {
    const looks = driftwoodRows('custom/fixedLayouts').nativeView.CREATURE_LOOKS;
    return look.kind === 'captain' ? looks.captain : glow === undefined ? looks.body : looks.glowing;
  };
  return { ...look, faceted: true, sharedBody: (glow) => body(name(glow)), material: (_sky, glow, intensity = 1) => {
    if (glow !== undefined) setLentParam(name(glow), 'glow', [glow[0] * intensity, glow[1] * intensity, glow[2] * intensity]);
    return body(name(glow)).clone();
  } };
}
