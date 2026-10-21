import { fileURLToPath } from 'node:url';
import * as rows from './interactables.ts';
import * as sea from './sea.ts';
import { TRAILS } from './landscapeRows.ts';
import TERRAIN from '../data/terrainBindings.json' with { type: 'json' };
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

const root = new URL('../', import.meta.url);
const writer = byteWriter(process.argv.includes('--check'), 'driftwood-interactables');
writer.put(fileURLToPath(new URL('data/interactables.generated.json', root)), jsonBytes(rows));
writer.put(fileURLToPath(new URL('data/interactables.generated.d.json.ts', root)), Buffer.from(`// Generated interaction data types; no runtime declarations.
import type { InteractTable } from '@wildshard/engine/world/interact/types';
declare const rows: {
  DRIFTWOOD_INTERACT: InteractTable;
  SHARD_FLAGS: string[];
  SEA_GLASS_COUNT: number;
  SEA_GLASS_FLAG: string;
  SEA_GLASS_POINTS: [number, number][];
  REEF_TREASURE: Extract<InteractTable['rows'][number], { kind: 'chest' }>;
};
export default rows;
`));
writer.put(fileURLToPath(new URL('boot/sea.generated.json', root)), jsonBytes(sea));
writer.put(fileURLToPath(new URL('boot/sea.generated.d.json.ts', root)), Buffer.from(`// Generated sea data types; no runtime declarations.
declare const sea: {
  SHORE_LEVEL: number; WORLD_DROP: number; PIER_START: number;
  DECLARED_SEA: { id: 'sea'; kind: 'sea'; level: number; waves: boolean; dryEntries: ('north' | 'east' | 'south' | 'west')[] };
};
export default sea;
`));
// G4: the manifest's declared ground (game `declaredGround`): the baked terrain by key and seed, the four mandated roads,
// the beach bed and inland paths, the lowered sea's rest level, the world drop as the datum and the declared sea
writer.put(fileURLToPath(new URL('boot/ground.generated.json', root)), jsonBytes({ terrain: { key: TERRAIN.key, seed: TERRAIN.seed },
  trails: TRAILS, cabinSites: [], water: sea.DECLARED_SEA.level, datum: -sea.WORLD_DROP, bodies: [sea.DECLARED_SEA], paths: 'plugin' }));
writer.finish();
