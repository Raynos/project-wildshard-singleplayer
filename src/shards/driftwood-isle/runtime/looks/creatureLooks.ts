import type * as THREE from 'three';
import type { MeshStandardNodeMaterial } from 'three/webgpu';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { GraphLiteral } from '@wildshard/format/materialGraph';
import { CREATURE_LOOKS } from '../../data/creatureLook';

/**
 * The island's creatures on their graph toon looks (data/creatureLook.ts): the runtime lends the compiled bodies before
 * the world builds (`setCreatureLooks`), and `graphCreatureLook` turns a species look into one whose `material` is a copy
 * of the body per animal (the factory tints its colour and flashes its emissive) on the faceted one-group body. There is
 * no classic stand-in: a creature made before the bodies were lent refuses.
 */
interface CreatureBodies { readonly body: MeshStandardNodeMaterial; readonly glowing: MeshStandardNodeMaterial; readonly glow: (value: GraphLiteral) => void }
let lent: CreatureBodies | null = null;

const isLitGraph = (m: THREE.Material | undefined): m is MeshStandardNodeMaterial => m !== undefined && Reflect.get(m, 'isMeshStandardNodeMaterial') === true;

/** Hand the creatures their compiled graph bodies and the glowing body's param writer, before the world builds. */
export function setCreatureLooks(materials: ReadonlyMap<string, THREE.Material>, setParam: (id: string, name: string, value: GraphLiteral) => void): void {
  const body = materials.get(CREATURE_LOOKS.body), glowing = materials.get(CREATURE_LOOKS.glowing);
  if (!isLitGraph(body) || !isLitGraph(glowing)) throw new Error('Creature looks: look.materials lacks the lit creature graphs');
  lent = { body, glowing, glow: (value) => { setParam(CREATURE_LOOKS.glowing, 'glow', value); } };
}

/** `look` drawn on the graph body: faceted, one copy of the body per animal; a species with an eye glow wears the glowing
 *  body, its glow the species' colour × intensity. */
export function graphCreatureLook(look: SpeciesLook): SpeciesLook {
  return { ...look, faceted: true, material: (_sky, glow, intensity = 1) => {
    if (lent === null) throw new Error(`Creature looks: no graph bodies lent for ${look.kind} (the runtime compiles them before the world builds)`);
    if (glow === undefined) return lent.body.clone();
    lent.glow([glow[0] * intensity, glow[1] * intensity, glow[2] * intensity]);
    return lent.glowing.clone();
  } };
}
