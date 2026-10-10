import { Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { TREE_BARK_EDITS } from '../data/paintLook';
import type { SkyHdName } from '../boot/files';
import { fitModel } from '@wildshard/sdk/looks/modelIntake';
import { hdMaterial, skyHd } from './meshes';

/**
 * The modelled trees (E407, top-10 row 2; `art/far-reach/round-26-trees/`): the mockups' natural conifers of varied
 * height and lean, broadleaf trees and round bushes, in place of the identical card firs. Codex references of the
 * mockups' trees, BiRefNet, Hunyuan3D-2 turbo + paint, finish.sh (6k tris, 512 WebP map). One instanced draw per model;
 * each tree spot draws one model by a seeded hash (mostly conifers), at its own yaw, scale and slight lean.
 */
export type TreeModel = 'tree-pine-tall' | 'tree-pine-wide' | 'tree-pine-young' | 'tree-oak' | 'tree-bush';
export const TREE_MODELS: readonly (TreeModel & SkyHdName)[] = ['tree-pine-tall', 'tree-pine-wide', 'tree-pine-young', 'tree-oak', 'tree-bush'];
/** Each model's height before a spot's scale (metres: the card fir stood ~6.6 m) and its share of the spots. */
export const TREES: Readonly<Record<TreeModel, { height: number; share: number }>> = {
  'tree-pine-tall': { height: 8.2, share: 0.3 }, 'tree-pine-wide': { height: 7.0, share: 0.25 }, 'tree-pine-young': { height: 4.6, share: 0.15 },
  'tree-oak': { height: 5.6, share: 0.15 }, 'tree-bush': { height: 2.0, share: 0.15 },
};

function hash(i: number): number { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

/** The trees at `at` (x, y, z, scale), or null when a model failed to load (the card firs stand in). */
export function trees(at: readonly (readonly [number, number, number, number])[]): Group | null {
  const group = new Group(); group.name = 'far.trees';
  const byModel = new Map<TreeModel, [number, number, number, number, number][]>();
  at.forEach(([x, y, z, s], i) => {
    let r = hash(i * 7 + 3), pick: TreeModel = 'tree-pine-tall';
    for (const name of TREE_MODELS) { r -= TREES[name].share; if (r <= 0) { pick = name; break; } }
    byModel.set(pick, [...(byModel.get(pick) ?? []), [x, y, z, s, i]]);
  });
  const m = new Matrix4(), q = new Quaternion(), tilt = new Quaternion(), up = new Vector3(0, 1, 0), side = new Vector3();
  for (const [name, list] of byModel) {
    const made = skyHd(name); if (made === null) return null;
    const g = fitModel(made.geometry, { size: TREES[name].height, by: 'height', floor: -0.15, centre: 'base' });
    const material = hdMaterial(made.map);
    // the paint's bark came out magenta-red: toward a warm grey-brown; the foliage kept
    patchShader(material, 'far.tree-bark', PATCH_ORDER.decorate, (shader) => {
      editShader(shader, TREE_BARK_EDITS);
    }, { key: (prior) => `${prior}|far.tree-bark` });
    const mesh = new InstancedMesh(g, material, list.length); mesh.name = `far.trees.${name}`;
    list.forEach(([x, y, z, s, i], k) => {
      const yaw = hash(i * 13 + 1) * Math.PI * 2, lean = (hash(i * 29 + 5) - 0.5) * 0.12, size = s * (0.8 + 0.4 * hash(i * 31 + 9));
      side.set(Math.cos(yaw), 0, Math.sin(yaw));
      q.setFromAxisAngle(up, yaw); tilt.setFromAxisAngle(side, lean); q.premultiply(tilt);
      m.compose(new Vector3(x, y, z), q, new Vector3(size, size, size)); mesh.setMatrixAt(k, m);
    });
    mesh.computeBoundingSphere(); group.add(mesh);
  }
  return group;
}
