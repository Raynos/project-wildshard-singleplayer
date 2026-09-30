import { stateSlot } from '../core/shardState';

/**
 * E322 F-L4: Pine Hollow's grass trample (Debug ▸ Ground cover & foliage ▸ Grass trample; off = the grass before). While
 * `on`, the carpet (src/world/Grass.ts) bends round Nalati's trample map + live movers (GrassTrample.ts) and pushes the
 * player into it, and AnimalManager pushes every moving animal near the player. Grass.ts owns the flag; Nalati never sets
 * it (its GrassV2 and Wildlife feed the same map their own way).
 */
export const pineTrample = { on: false };

// E155 (src/core/shardState.ts): the running shard's
stateSlot('grass.pineTrample', pineTrample);
