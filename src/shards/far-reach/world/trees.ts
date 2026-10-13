import { Group, InstancedMesh } from 'three';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { TREE_BARK_EDITS } from '../data/paintLook';
import type { SkyHdName } from '../data/files';
import { fitGeometry } from '@wildshard/sdk/looks/modelLibrary';
import { hdMaterial, skyHd } from './meshes';

/**
 * The modelled trees (E407, top-10 row 2; `art/far-reach/round-26-trees/`): the mockups' natural conifers of varied
 * height and lean, broadleaf trees and round bushes, in place of the identical card firs. Codex references of the
 * mockups' trees, BiRefNet, Hunyuan3D-2 turbo + paint, finish.sh (6k tris, 512 WebP map). One instanced draw per model;
 * each tree spot draws one model by a seeded hash (mostly conifers), at its own yaw, scale and slight lean (placed offline,
 * generators/placements.ts).
 */
export type TreeModel = 'tree-pine-tall' | 'tree-pine-wide' | 'tree-pine-young' | 'tree-oak' | 'tree-bush';
export const TREE_MODELS: readonly (TreeModel & SkyHdName)[] = ['tree-pine-tall', 'tree-pine-wide', 'tree-pine-young', 'tree-oak', 'tree-bush'];
/** Each model's height before a spot's scale (metres: the card fir stood ~6.6 m) and its share of the spots. */
export const TREES: Readonly<Record<TreeModel, { height: number; share: number }>> = {
  'tree-pine-tall': { height: 8.2, share: 0.3 }, 'tree-pine-wide': { height: 7.0, share: 0.25 }, 'tree-pine-young': { height: 4.6, share: 0.15 },
  'tree-oak': { height: 5.6, share: 0.15 }, 'tree-bush': { height: 2.0, share: 0.15 },
};

/** The trees at their baked matrices, one instanced draw per model (generators/placements.ts), or null when a model failed to load. */
export function trees(placed: readonly { readonly model: string; readonly m: readonly number[] }[]): Group | null {
  const group = new Group(); group.name = 'far.trees';
  for (const { model, m } of placed) {
    const name = TREE_MODELS.find((n) => n === model), made = name === undefined ? null : skyHd(name); if (name === undefined || made === null) return null;
    const g = fitGeometry(made.geometry, { size: TREES[name].height, by: 'height', floor: -0.15, centre: 'base' });
    const material = hdMaterial(made.map);
    // the paint's bark came out magenta-red: toward a warm grey-brown; the foliage kept
    patchShader(material, 'far.tree-bark', PATCH_ORDER.decorate, (shader) => {
      editShader(shader, TREE_BARK_EDITS);
    }, { key: (prior) => `${prior}|far.tree-bark` });
    const mesh = new InstancedMesh(g, material, m.length / 16); mesh.name = `far.trees.${name}`;
    mesh.instanceMatrix.array.set(m); mesh.computeBoundingSphere(); group.add(mesh);
  }
  return group;
}
