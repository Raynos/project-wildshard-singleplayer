import { DoubleSide, MeshStandardMaterial, type Material } from 'three';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { paintIsleMaterial } from './isle';
import dressing from '../data/dressing.json' with { type: 'json' };
import { BOULDER_EDITS, CLUMP_EDITS, FLOWER_EDITS } from '../data/dressingLook';

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

let clumps: MeshStandardMaterial | null = null;
/**
 * A dressing kind's own material (its row's `dressing`), made as the piece is drawn, in row order: the clumps carry the
 * meadow beyond the near field (world/meadow.ts) and shrink away inside it so the fine blades own the foreground; the lip
 * clumps (the next kind) lean out over every rim in the clumps' material (E407 row 4); the flowers grow in past the near
 * meadow's own; the boulders wear the islands' painted rock and moss with their own near detail over it (E392).
 */
export function dressingMaterial(kind: string): Material | undefined {
  if (kind === 'lip') return clumps ?? undefined;
  if (kind === 'clump') {
    clumps = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 1, metalness: 0 });
    patchShader(clumps, 'far.clump-handoff', PATCH_ORDER.decorate, (shader) => { editShader(shader, CLUMP_EDITS); }, { key: (prior) => `${prior}|far.clump-handoff` });
    return clumps;
  }
  if (kind === 'flower') {
    const flowers = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 1, metalness: 0, emissive: 0x2a2418 });
    patchShader(flowers, 'far.flower-handoff', PATCH_ORDER.decorate, (shader) => { editShader(shader, FLOWER_EDITS); }, { key: (prior) => `${prior}|far.flower-handoff` });
    return flowers;
  }
  if (kind !== 'stone') return undefined;
  const stones = paintIsleMaterial(new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }));
  patchShader(stones, 'far.boulder-detail', PATCH_ORDER.decorate + 10, (shader) => { editShader(shader, BOULDER_EDITS); }, { key: (prior) => `${prior}|far.boulder-detail` });
  return stones;
}
