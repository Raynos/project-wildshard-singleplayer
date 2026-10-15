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
interface CreatureBodies {
  readonly body: MeshStandardNodeMaterial; readonly glowing: MeshStandardNodeMaterial; readonly captain: MeshStandardNodeMaterial;
  readonly glow: (id: string, value: GraphLiteral) => void; readonly coat: (texture: THREE.Texture) => void;
}
let lent: CreatureBodies | null = null;

const isLitGraph = (m: THREE.Material | undefined): m is MeshStandardNodeMaterial => m !== undefined && Reflect.get(m, 'isMeshStandardNodeMaterial') === true;

/** Hand the creatures their compiled graph bodies and the glowing bodies' param and coat writers, before the world builds. */
export function setCreatureLooks(materials: ReadonlyMap<string, THREE.Material>, setParam: (id: string, name: string, value: GraphLiteral) => void,
  setTexture: (id: string, name: string, texture: THREE.Texture) => void): void {
  const body = materials.get(CREATURE_LOOKS.body), glowing = materials.get(CREATURE_LOOKS.glowing), captain = materials.get(CREATURE_LOOKS.captain);
  if (!isLitGraph(body) || !isLitGraph(glowing) || !isLitGraph(captain)) throw new Error('Creature looks: look.materials lacks the lit creature graphs');
  lent = { body, glowing, captain, glow: (id, value) => { setParam(id, 'glow', value); }, coat: (texture) => { setTexture(CREATURE_LOOKS.captain, 'coatMap', texture); } };
}

/** `look` drawn on the graph body: faceted, one copy of the body per animal; a species with an eye glow wears the glowing
 *  body, its glow the species' colour × intensity. */
export function graphCreatureLook(look: SpeciesLook): SpeciesLook {
  return { ...look, faceted: true, material: (_sky, glow, intensity = 1) => {
    if (lent === null) throw new Error(`Creature looks: no graph bodies lent for ${look.kind} (the runtime compiles them before the world builds)`);
    if (glow === undefined) return lent.body.clone();
    lent.glow(CREATURE_LOOKS.glowing, [glow[0] * intensity, glow[1] * intensity, glow[2] * intensity]);
    return lent.glowing.clone();
  } };
}

/** The Drowned Captain's `look` on his graph body: faceted, his painted coat (`coat()`, the GLB's map) lent to it, his eye
 *  glow the species' colour × intensity. */
export function graphCaptainLook(look: SpeciesLook, coat: () => THREE.Texture | null): SpeciesLook {
  return { ...look, faceted: true, material: (_sky, glow, intensity = 1) => {
    if (lent === null) throw new Error('Creature looks: no graph body lent for the captain (the runtime compiles it before the world builds)');
    const map = coat();
    if (map === null) throw new Error('Creature looks: the captain has no painted coat');
    lent.coat(map);
    if (glow !== undefined) lent.glow(CREATURE_LOOKS.captain, [glow[0] * intensity, glow[1] * intensity, glow[2] * intensity]);
    return lent.captain.clone();
  } };
}
