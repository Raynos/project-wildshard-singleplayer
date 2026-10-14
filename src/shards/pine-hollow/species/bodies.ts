import type { AnimalDims, AnimalSpecies, BoneDef } from '@wildshard/engine/entities/species/registry';

/**
 * The deer's and the elk's bodies as data (SHARD-PLATFORM, sp-o194): Pine draws both only on their rigged hulls
 * (species/hulls.ts), which take the bones' rest from the rig and need from the species nothing but the skeleton (names
 * and parents) and the dims. The procedural lofts these rows come from are offline (generators/creatureLofts.ts);
 * test/pine-creature-bodies.test.ts keeps the two equal. A hull that is not loaded refuses (species/looks.ts); nothing is
 * lofted on the page.
 */
type BoneRow = readonly [name: string, parent: string | null, x: number, y: number, z: number];
interface BodyRow { readonly bones: readonly BoneRow[]; readonly dims: Omit<AnimalDims, 'feet'> & { readonly feet: readonly (readonly [number, number])[] } }

/** the quadruped skeleton (spine, ears, tail, belly; per side shoulder → carpus → fetlock and hip → stifle → hock) */
function quadruped(spine: readonly (readonly [number, number, number])[], legs: readonly (readonly [number, number, number])[]): BoneRow[] {
  const names = ['body', 'neck1', 'neck2', 'head', 'earL', 'earR', 'tail', 'belly'] as const;
  const parents = [null, 'body', 'neck1', 'neck2', 'head', 'head', 'body', 'body'] as const;
  const out: BoneRow[] = spine.map((p, i) => [names[i] ?? 'body', parents[i] ?? null, p[0], p[1], p[2]]);
  for (const [side, sx] of [['L', 1], ['R', -1]] as const) {
    const chain = [[`F${side}_shoulder`, 'body'], [`F${side}_carpus`, `F${side}_shoulder`], [`F${side}_fetlock`, `F${side}_carpus`],
      [`B${side}_hip`, 'body'], [`B${side}_stifle`, `B${side}_hip`], [`B${side}_hock`, `B${side}_stifle`]] as const;
    chain.forEach(([name, parent], i) => { const p = legs[i] ?? [0, 0, 0]; out.push([name, parent, sx * p[0], p[1], p[2]]); });
  }
  return out;
}

/** Each kind's body: the bones (left legs; the right mirror them) and the dims, as the lofts make them. */
export const PINE_BODIES: Readonly<Record<'deer' | 'elk', BodyRow>> = {
  deer: {
    bones: quadruped([[0, 0.92, -0.05], [0, 1.04, 0.62], [0, 1.34, 0.86], [0, 1.68, 1.04], [0.075, 1.79, 1.08], [-0.075, 1.79, 1.08], [0, 1, -0.9], [0, 0.8, 0]],
      [[0.15, 0.92, 0.45], [0.15, 0.48, 0.45], [0.15, 0.12, 0.45], [0.14, 0.93, -0.55], [0.14, 0.58, -0.46], [0.15, 0.4, -0.61]]),
    dims: { bodyY: 0.92, bodyHalfLen: 0.72, bodyRadius: 0.33, headRadius: 0.17, legLen: 0.92, feet: [[0.155, 0.49], [-0.155, 0.49], [0.155, -0.59], [-0.155, -0.59]], halfWidth: 0.27 },
  },
  elk: {
    bones: quadruped([[0, 1.5, -0.06], [0, 1.66, 0.8], [0, 2.06, 1.16], [0, 2.28, 1.4], [0.12, 2.43, 1.46], [-0.12, 2.43, 1.46], [0, 1.62, -1.12], [0, 1.3, 0]],
      [[0.24, 1.5, 0.56], [0.24, 0.78, 0.56], [0.24, 0.2, 0.56], [0.224, 1.52, -0.69], [0.224, 0.95, -0.575], [0.24, 0.65, -0.76]]),
    dims: { bodyY: 1.5, bodyHalfLen: 0.95, bodyRadius: 0.52, headRadius: 0.26, legLen: 1.5, feet: [[0.248, 0.6125], [-0.248, 0.6125], [0.248, -0.7374999999999999], [-0.248, -0.7374999999999999]], halfWidth: 0.42 },
  },
};

/** A kind's `build`: its baked skeleton and dims, fresh per call, and no lofted parts (the hull is the mesh). */
export function hullBody(kind: 'deer' | 'elk'): () => AnimalSpecies {
  const row = PINE_BODIES[kind];
  return () => ({
    bones: row.bones.map(([name, parent, x, y, z]): BoneDef => ({ name, parent, pos: [x, y, z] })),
    furParts: [], hardParts: [], eyeParts: [],
    dims: { ...row.dims, feet: row.dims.feet.map((f): [number, number] => [f[0], f[1]]) },
  });
}
