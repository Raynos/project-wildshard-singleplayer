import type { SkyCreature } from './files';

interface Bone { readonly name: string; readonly parent: string | null; readonly pos: readonly [number, number, number] }
interface Dims { readonly bodyY: number; readonly bodyHalfLen: number; readonly bodyRadius: number; readonly headRadius: number; readonly legLen: number; readonly halfWidth: number }

/**
 * Each baked creature's undrawn stand-in skeleton and body size (species/bodies.ts `skyBody`): what a species builds when
 * its baked rig did not load (a page fault), as Signal's skitterer does (`undrawnRig`). The sockets match each look's
 * rig contract, so its clips still drive the bones.
 */
export const SKY_STAND_INS: Readonly<Record<SkyCreature, { readonly bones: readonly Bone[]; readonly dims: Dims }>> = {
  'drift-ray': {
    bones: [{ name: 'body', parent: null, pos: [0, 0.3, 0] }, { name: 'head', parent: 'body', pos: [0, 0.3, 1.5] },
      { name: 'wingL', parent: 'body', pos: [1, 0.3, 0] }, { name: 'wingR', parent: 'body', pos: [-1, 0.3, 0] }, { name: 'tail', parent: 'body', pos: [0, 0.3, -1.2] }],
    dims: { bodyY: 0.3, bodyHalfLen: 1.4, bodyRadius: 0.9, headRadius: 0.4, legLen: 0.1, halfWidth: 2.7 },
  },
  'sky-goat': {
    bones: [{ name: 'body', parent: null, pos: [0, 0.85, 0] }, { name: 'head', parent: 'body', pos: [0, 1.15, 0.6] },
      { name: 'legFL', parent: 'body', pos: [0.22, 0.7, 0.4] }, { name: 'legFR', parent: 'body', pos: [-0.22, 0.7, 0.4] },
      { name: 'legBL', parent: 'body', pos: [0.22, 0.7, -0.4] }, { name: 'legBR', parent: 'body', pos: [-0.22, 0.7, -0.4] }],
    dims: { bodyY: 0.85, bodyHalfLen: 0.6, bodyRadius: 0.35, headRadius: 0.22, legLen: 0.7, halfWidth: 0.35 },
  },
  'gale-wisp': {
    bones: [{ name: 'body', parent: null, pos: [0, 0, 0] }, { name: 'head', parent: 'body', pos: [0, 0.1, 0.2] }, { name: 'swirl', parent: 'body', pos: [0, 0, 0] }],
    dims: { bodyY: 0, bodyHalfLen: 0.4, bodyRadius: 0.45, headRadius: 0.2, legLen: 0.1, halfWidth: 0.75 },
  },
  'storm-roc': {
    bones: [{ name: 'body', parent: null, pos: [0, 1.6, 0] }, { name: 'head', parent: 'body', pos: [0, 2.1, 1.6] },
      { name: 'wingL', parent: 'body', pos: [1.1, 1.7, 0] }, { name: 'wingR', parent: 'body', pos: [-1.1, 1.7, 0] }, { name: 'tail', parent: 'body', pos: [0, 1.5, -1.4] }],
    dims: { bodyY: 1.6, bodyHalfLen: 1.4, bodyRadius: 1.1, headRadius: 0.55, legLen: 1, halfWidth: 5.5 },
  },
};
