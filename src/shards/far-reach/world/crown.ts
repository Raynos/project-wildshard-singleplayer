import { InstancedMesh, Matrix4, Mesh, Quaternion, Vector3, type Group } from 'three';
import { CROWN, DAIS } from '../data/layout';
import { fitGeometry } from '@wildshard/sdk/looks/modelLibrary';
import { hdMaterial, skyHd } from './meshes';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { CROWN_DAIS_EDITS } from '../data/paintLook';
import { CROWN_STONES, type Stone } from '../data/crownLayout';
import { skyBakedPiece } from './baked';

/**
 * The arena (loop 4, mockup D), in world space (add it to the level root): the modelled standing stones with cut spiral
 * runes and the carved compass dais (top-10 row 7, art/far-reach/round-28-crown/; undrawn when a model did not load), and
 * the pennant ropes and flags, built offline (`generators/crown.ts` → `baked/crown.glb`); its colliders are the rows'
 * (the dais and each stone).
 */
export function crownArena(): { group: Group; colliders: ReturnType<typeof skyBakedPiece>['colliders'] } {
  const baked = skyBakedPiece('crown'), group = baked.root; group.name = 'far.crown.arena';
  group.add(...carvedSet(CROWN_STONES));
  return { group, colliders: baked.colliders };
}

/** How the modelled set stands: each model's front (its rune) turned to the dais by `yaw`; the dais squashed to `daisH` m. */
export const CARVED = { yaw: 0, daisH: 0.42, sink: 0.15 } as const;

/** The modelled stones (two models, alternating) and dais; none when one failed to load. */
function carvedSet(stones: readonly Stone[]): Mesh[] {
  const a = skyHd('crown-stone'), b = skyHd('crown-stone-b'), d = skyHd('crown-dais');
  if (a === null || b === null || d === null) return [];
  const out: Mesh[] = [], m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0);
  for (const [k, made] of [a, b].entries()) {
    const list = stones.filter((_, i) => i % 2 === k);
    const g = fitGeometry(made.geometry, { size: 1, by: 'height', floor: 0, centre: 'base' });
    const mesh = new InstancedMesh(g, hdMaterial(made.map), list.length); mesh.name = `far.crown.stone-${k}`;
    list.forEach((st, i) => {
      q.setFromAxisAngle(up, st.yaw + CARVED.yaw); m.compose(new Vector3(st.x, CROWN.y - CARVED.sink, st.z), q, new Vector3(st.h, st.h, st.h)); mesh.setMatrixAt(i, m);
    });
    mesh.computeBoundingSphere(); out.push(mesh);
  }
  const dg = fitGeometry(d.geometry, { size: DAIS.r * 2, by: 'span', floor: 0, centre: 'base' }); dg.computeBoundingBox();
  const h = dg.boundingBox ? dg.boundingBox.max.y : 1; dg.scale(1, CARVED.daisH / Math.max(1e-3, h), 1);
  const daisMat = hdMaterial(d.map);
  // the paint came out red-brown; mockup D's dais is weathered grey stone with a warm cast
  patchShader(daisMat, 'far.crown-dais', PATCH_ORDER.decorate, (shader) => {
    editShader(shader, CROWN_DAIS_EDITS);
  }, { key: (prior) => `${prior}|far.crown-dais` });
  const dais = new Mesh(dg, daisMat); dais.name = 'far.crown.dais'; dais.position.set(DAIS.x, CROWN.y - 0.08, DAIS.z);
  out.push(dais);
  return out;
}
