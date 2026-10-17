import { fileURLToPath } from 'node:url';
import * as rows from './interactables.ts';
import * as sea from './sea.ts';
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
writer.finish();
