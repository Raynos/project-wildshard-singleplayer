import { SKY_LIBRARY } from './meshes';
import type { Material } from 'three';
import { DRESSING_LOOKS } from '../data/dressingLook';

/**
 * The island dressing (Gilded Air, review items 6 / 7, loop 2): grass clumps, the rims' lip clumps, flowers and boulders,
 * all instanced, no colliders, one draw each. SHARD-PLATFORM M3: placed offline (`generators/dressing.ts`, a baked world
 * piece: `baked/dressing.glb` + `data/dressing.json`, its exact matrices and the flowers' colours in the GLB);
 * `world/baked.ts` draws it in the materials below (their edits are data/dressingLook.ts).
 */

/**
 * A dressing kind's own material (its row's `dressing`, looked up in data/dressingLook.ts `DRESSING_LOOKS`), as the piece is
 * drawn: the clumps carry the meadow beyond the near field (world/meadow.ts) and shrink away inside it so the fine blades
 * own the foreground, the flowers grow in past the near meadow's own (their graphs, `look.materials`); the boulders wear
 * the islands' painted rock and moss with their own near detail over it (E392).
 */
export const dressingMaterial = (kind: string): Material | undefined => SKY_LIBRARY.look(DRESSING_LOOKS[kind] ?? '');
