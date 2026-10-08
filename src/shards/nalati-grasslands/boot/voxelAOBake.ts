/**
 * SF67 fix 3 (E461): Nalati's voxel AO, baked at build. Every painted model the world builds (the nomad camps, the
 * outcrops, the dressing, the Kurgan …) marched its voxel AO on the main thread at load; the AO is a pure function of each
 * model's geometry, so scripts/bake-voxel-ao.mjs builds the world in Node and records it, and the world build here runs
 * with that table added (src/engine/world/voxelAO.ts `addVoxelAOBake`). A missing or stale file costs nothing but the
 * march: a model whose inputs hash differently computes its AO in code as before. The table is dropped once the world is
 * built.
 */
import { addVoxelAOBake } from '@wildshard/engine/world/voxelAO';

const bakeBytes = (): Promise<ArrayBuffer | null> => fetch('/assets/nalati/baked/voxel-ao.bin').then((r) => (r.ok ? r.arrayBuffer() : null), () => null);

/** run the world build with the baked voxel AO added */
export async function withVoxelAOBake<T>(build: () => Promise<T>): Promise<T> {
  const drop = addVoxelAOBake(await bakeBytes());
  try { return await build(); } finally { drop(); }
}
