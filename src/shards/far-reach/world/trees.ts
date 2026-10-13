import { Group, InstancedMesh } from 'three';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { TREE_BARK_EDITS } from '../data/paintLook';
import { TREE_MODELS, type TreeModel as AuthoredTreeModel } from '../data/trees';

import { hdMaterial, skyHd } from './meshes';

/** The authored tree model identity used by placements. */
export type TreeModel = AuthoredTreeModel;

/**
 * The modelled trees (E407, top-10 row 2; `art/far-reach/round-26-trees/`): the mockups' natural conifers of varied
 * height and lean, broadleaf trees and round bushes, in place of the identical card firs. Codex references of the
 * mockups' trees, BiRefNet, Hunyuan3D-2 turbo + paint, finish.sh (6k tris, 512 WebP map). One instanced draw per model;
 * each tree spot draws one model by a seeded hash (mostly conifers), at its own yaw, scale and slight lean (placed offline,
 * generators/placements.ts).
 */
/** The trees at their baked matrices, one instanced draw per model (generators/placements.ts), or null when a model failed to load. */
export async function trees(placed: readonly { readonly model: string; readonly m: readonly number[] }[], pause: () => Promise<void> = () => Promise.resolve()): Promise<Group | null> {
  const group = new Group(); group.name = 'far.trees';
  for (const { model, m } of placed) {
    const name = TREE_MODELS.find((n) => n === model), made = name === undefined ? null : skyHd(name); if (name === undefined || made === null) return null;
    const g = made.geometry;
    const material = hdMaterial(made.map);
    // the paint's bark came out magenta-red: toward a warm grey-brown; the foliage kept
    patchShader(material, 'far.tree-bark', PATCH_ORDER.decorate, (shader) => {
      editShader(shader, TREE_BARK_EDITS);
    }, { key: (prior) => `${prior}|far.tree-bark` });
    const mesh = new InstancedMesh(g, material, m.length / 16); mesh.name = `far.trees.${name}`;
    mesh.instanceMatrix.array.set(m); mesh.computeBoundingSphere(); group.add(mesh);
    await pause();
  }
  return group;
}
