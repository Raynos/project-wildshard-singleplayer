import { MeshStandardMaterial, type Material } from 'three';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { paintIsleMaterial } from './isle';
import dressing from '../data/dressing.json' with { type: 'json' };
import { BOULDER_EDITS } from '../data/dressingLook';
import { skyLook } from './looks';

/**
 * The island dressing (Gilded Air, review items 6 / 7, loop 2): grass clumps, the rims' lip clumps, flowers and boulders,
 * all instanced, no colliders, one draw each. SHARD-PLATFORM M3: placed offline (`generators/dressing.ts`, a baked world
 * piece: `baked/dressing.glb` + `data/dressing.json`, its exact matrices and the flowers' colours in the GLB);
 * `world/baked.ts` draws it in the materials below (their edits are data/dressingLook.ts).
 */

/** The hero boulders and the meadow's larger rocks, as discs (x, z, radius) for the meadow's short grass round them. */
export function heroStoneDiscs(): [number, number, number][] {
  return dressing.discs.map(([x = 0, z = 0, r = 0]) => [x, z, r]);
}

/**
 * A dressing kind's own material (its row's `dressing`), as the piece is drawn: the clumps (and the lip clumps, which lean
 * out over every rim, E407 row 4) carry the meadow beyond the near field (world/meadow.ts) and shrink away inside it so the
 * fine blades own the foreground, the flowers grow in past the near meadow's own (their graphs, `look.materials`); the
 * boulders wear the islands' painted rock and moss with their own near detail over it (E392).
 */
export function dressingMaterial(kind: string): Material | undefined {
  if (kind === 'clump' || kind === 'lip') return skyLook('dressing-clump');
  if (kind === 'flower') return skyLook('dressing-flower');
  if (kind !== 'stone') return undefined;
  const stones = paintIsleMaterial(new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }));
  patchShader(stones, 'far.boulder-detail', PATCH_ORDER.decorate + 10, (shader) => { editShader(shader, BOULDER_EDITS); }, { key: (prior) => `${prior}|far.boulder-detail` });
  return stones;
}
