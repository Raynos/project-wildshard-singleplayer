/**
 * The creature bodies' skeletons and sizes as plain rows (G320): the rig bake (generators/species.ts, generators/hulls.ts)
 * reads them with no species or clip module, and the client's stand-ins (world/meshes.ts) read the same rows.
 */

/** The skitterer's skeleton (absolute bind space, +Z forward) and size: baked beside its skin (generators/species.ts), and its stand-in when the rig did not load. */
export const SKITTERER_BODY = {
  bones: [{ name: 'body', parent: null, pos: [0, 0.22, 0] }, { name: 'head', parent: 'body', pos: [0, 0.22, 0.42] },
    { name: 'legsL', parent: 'body', pos: [-0.18, 0.14, 0] }, { name: 'legsR', parent: 'body', pos: [0.18, 0.14, 0] }, { name: 'tail', parent: 'body', pos: [0, 0.26, -0.45] }],
  dims: { bodyY: 0.22, bodyHalfLen: 0.45, bodyRadius: 0.3, headRadius: 0.17, legLen: 0.2, halfWidth: 0.45 },
} as const;
/** The ray's skeleton (absolute bind space, +Z forward: body first, then head, the two wings and the tail) and size: baked
 *  beside the manta's skin (generators/hulls.ts) for the ray and the Matriarch, and their stand-in when a rig did not load. */
export const RAY_BODY = {
  bones: [{ name: 'body', parent: null, pos: [0, 0.3, 0] }, { name: 'head', parent: 'body', pos: [0, 0.3, 1.2] },
    { name: 'wingL', parent: 'body', pos: [-0.9, 0.3, 0] }, { name: 'wingR', parent: 'body', pos: [0.9, 0.3, 0] }, { name: 'tail', parent: 'body', pos: [0, 0.3, -1.0] }],
  dims: { bodyY: 0.3, bodyHalfLen: 1.1, bodyRadius: 0.8, headRadius: 0.4, legLen: 0, halfWidth: 2.6 },
} as const;
/** The strider's dims on its fitted hull (data/species/strider.ts STRIDER_LOOK): body height and leg length as shares of the hull's height. */
export const STRIDER_DIMS = { bodyY: 0.7, bodyHalfLen: 1.3, bodyRadius: 0.75, headRadius: 0.4, legLen: 0.5, halfWidth: 0.7 } as const;
