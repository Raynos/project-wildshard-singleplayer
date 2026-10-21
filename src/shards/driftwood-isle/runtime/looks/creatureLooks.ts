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

/** `look` drawn on the graph body: faceted, one copy of the body per animal; a species with an eye glow wears the glowing
 *  body, its glow the species' colour × intensity. */
export function graphCreatureLook(look: SpeciesLook): SpeciesLook {
  return { ...look, faceted: true, sharedBody: (glow) => {
    const looks = driftwoodRows('custom/fixedLayouts').nativeView.CREATURE_LOOKS;
    return body(glow === undefined ? looks.body : looks.glowing);
  }, material: (_sky, glow, intensity = 1) => {
    if (glow === undefined) return body(driftwoodRows('custom/fixedLayouts').nativeView.CREATURE_LOOKS.body).clone();
    setLentParam(driftwoodRows('custom/fixedLayouts').nativeView.CREATURE_LOOKS.glowing, 'glow', [glow[0] * intensity, glow[1] * intensity, glow[2] * intensity]);
    return body(driftwoodRows('custom/fixedLayouts').nativeView.CREATURE_LOOKS.glowing).clone();
  } };
}

/** The Drowned Captain's `look` on his graph body: faceted, his painted coat the graph's admitted texture, his eye glow the
 *  species' colour × intensity. */
export function graphCaptainLook(look: SpeciesLook): SpeciesLook {
  return { ...look, faceted: true, sharedBody: () => body(driftwoodRows('custom/fixedLayouts').nativeView.CREATURE_LOOKS.captain), material: (_sky, glow, intensity = 1) => {
    if (glow !== undefined) setLentParam(driftwoodRows('custom/fixedLayouts').nativeView.CREATURE_LOOKS.captain, 'glow', [glow[0] * intensity, glow[1] * intensity, glow[2] * intensity]);
    return body(driftwoodRows('custom/fixedLayouts').nativeView.CREATURE_LOOKS.captain).clone();
  } };
}
