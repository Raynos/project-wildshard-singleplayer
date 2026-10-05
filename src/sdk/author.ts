import { parseShardfile, type Shardfile } from './shardfile';
import { ENTRY_WIDTH } from '@wildshard/engine/core/config';
import { LOOK_LUT_BYTES } from '@wildshard/game/shardfile/schema';

/** Attach an already declared 33³ LUT to the charged library, accounting for both its CPU and GPU bytes once. */
export function declareLookLut(shard: Shardfile, hash: string): void {
  const file = shard.files.find((row) => row.hash === hash);
  if (file?.kind !== 'binary' || file.compressed !== LOOK_LUT_BYTES || file.decoded < LOOK_LUT_BYTES || file.gpu < LOOK_LUT_BYTES) throw new Error('Look LUT requires its exact binary file and CPU/GPU declaration');
  const library = new Set<string>(), pending = [...shard.library];
  while (pending.length > 0) { const ref = pending.pop(); if (ref === undefined || library.has(ref)) continue; library.add(ref); pending.push(...shard.files.find((row) => row.hash === ref)?.dependencies ?? []); }
  if (!library.has(hash)) {
    shard.library.push(hash);
    shard.budgets.library.compressed += file.compressed; shard.budgets.library.resident += file.decoded + file.gpu;
  }
  shard.look.grade.lut = hash;
}

/** Start an author project with a valid empty world; add baked content before shipping a playable shard. */
export function emptyShardfile(identity: Shardfile['identity']): Shardfile {
  const edge = { heights: Array.from({ length: 257 }, () => 0), colours: Array.from({ length: 257 }, () => [0.5, 0.5, 0.5]), roadHeight: 0 };
  return parseShardfile({ version: 0, identity, accent: 'sand', requires: { sdk: 0, capabilities: [], commons: [], commonsWire: {}, commonsCosts: {} }, budgets: { library: { resident: 0, compressed: 0 }, sim: { resident: 0, compressed: 0 }, overlap: 0 },
    entryways: [{ edge: 'north', at: [0, 0, 250], width: ENTRY_WIDTH }, { edge: 'east', at: [250, 0, 0], width: ENTRY_WIDTH }, { edge: 'south', at: [0, 0, -250], width: ENTRY_WIDTH }, { edge: 'west', at: [-250, 0, 0], width: ENTRY_WIDTH }],
    look: { families: [], grade: { exposure: 0, saturation: 1, contrast: 1, lut: null }, clock: 'engine', dayOverride: null, keys: [] },
    sim: { fixedHz: 60, scriptTickDivisor: 2, commandVersion: 0, snapshotVersion: 0, scripts: [] },
    state: { version: 1, sharedOwner: 'host', playerKey: 'actorId', shared: [], player: [] }, authorCaps: { players: 32, speed: 15 },
    serverBudget: { tickMicros: 1000, memory: 1_000_000, entities: 100, commandsPerTick: 32 }, edge: { north: edge, south: edge, east: edge, west: edge }, files: [], tiles: [], library: [], critical: [], far: null });
}
