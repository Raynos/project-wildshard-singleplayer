/**
 * The trader's and the castaway's low-poly kit meshes, built offline (SHARD-PLATFORM W2) from their rows
 * (data/npcScenes.ts, data/castawayLook.ts) by the kit builder (generators/kitParts.ts): the same seeds, parts and AO.
 * The castaway's camp is built about its fire (the parts marked `rel` off the origin); the Castaway moves its copy to
 * where his fire burns. They load as the fixed-model templates `npc-trader-*` and `npc-castaway-*`.
 */
import type { BufferGeometry } from 'three';
import { CASTAWAY_FLAMES } from '../data/castawayLook';
import { CASTAWAY_MESHES, TRADER_MESHES } from '../data/npcScenes';
import { buildKitMesh } from './kitParts';

/** Every NPC kit mesh by template name, in a fixed order. */
export function npcKitGeometry(): Map<string, BufferGeometry> {
  const out = new Map<string, BufferGeometry>();
  for (const [id, row] of TRADER_MESHES) out.set(`npc-trader-${id}`, buildKitMesh(row));
  for (const [id, row] of CASTAWAY_MESHES) out.set(`npc-castaway-${id}`, buildKitMesh(row));
  out.set('npc-castaway-flames', buildKitMesh(CASTAWAY_FLAMES));
  return out;
}
