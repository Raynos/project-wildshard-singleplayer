/**
 * The trader's and the castaway's low-poly kit meshes, built offline (SHARD-PLATFORM W2) from their authored rows
 * (generators/traderLook.ts, generators/castawayLook.ts) by the kit builder (generators/kitParts.ts): the same seeds, parts and AO.
 * The castaway's camp is built about its fire (the parts marked `rel` off the origin); the Castaway moves its copy to
 * where his fire burns. They load as the fixed-model templates `npc-trader-*` and `npc-castaway-*`.
 */
import type { BufferGeometry } from 'three';
import { CASTAWAY_ARM, CASTAWAY_BODY, CASTAWAY_CAMP, CASTAWAY_FLAMES, CASTAWAY_HEAD } from './castawayLook';
import { TRADER_BODY, TRADER_FORE, TRADER_HEAD, TRADER_UPPER } from './traderLook';
import { buildKitMesh } from './kitParts';

/** Every NPC kit mesh by template name, in a fixed order. */
export function npcKitGeometry(): Map<string, BufferGeometry> {
  const rows = {
    'npc-trader-body': TRADER_BODY, 'npc-trader-head': TRADER_HEAD, 'npc-trader-upper': TRADER_UPPER, 'npc-trader-fore': TRADER_FORE,
    'npc-castaway-body': CASTAWAY_BODY, 'npc-castaway-camp': CASTAWAY_CAMP, 'npc-castaway-head': CASTAWAY_HEAD,
    'npc-castaway-arm': CASTAWAY_ARM, 'npc-castaway-flames': CASTAWAY_FLAMES,
  };
  return new Map(Object.entries(rows).map(([name, row]) => [name, buildKitMesh(row)]));
}
