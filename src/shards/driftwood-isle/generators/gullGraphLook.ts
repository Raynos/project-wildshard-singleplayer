// SHARD-PLATFORM W2 C4 (look-family rows): Driftwood's herring gulls (the GULL_FLOCK row on @wildshard/game/ambient/ambientFlock, one instanced mesh)
// on the graph toon look (`look.materials`, compiled by the runtime with its other looks, runtime/hybrid.ts). The flap
// rig that was GLSL is the vertex stage: each part (`aPart`) turned about its joint from the instance's `aAnim`
// (flap, head yaw, wing fold, leg tuck), then the instance's own transform; the surface is the vertex paint, matte.
// G466 C2: the graphs are authored graph JSON (data/lookGraphs.json).

/** the look.materials id the gulls wear */
export const GULL_GRAPH_LOOK = 'driftwood-gulls';

/** the rig's joints, gull-local (forward = +z, up = +y, right = +x); the flock's geometry is built about them */
export const GULL_RIG = { shoulderX: 0.06, shoulderY: 0.045, elbowX: 0.36, neck: [0, 0.05, 0.15], hip: [0, -0.06, 0.0] } as const;
