import { fileURLToPath } from 'node:url';
import { parseLootEconomy } from '@wildshard/format/lootEconomy';
import { DRIFTWOOD_LOOT } from './loot.ts';
import { byteWriter } from '../../../../scripts/bake-output.mjs';

const writer = byteWriter(process.argv.includes('--check'), 'driftwood-loot');
parseLootEconomy(DRIFTWOOD_LOOT.economy);
writer.put(fileURLToPath(new URL('../data/loot.generated.json', import.meta.url)), `${JSON.stringify(DRIFTWOOD_LOOT)}\n`);
writer.finish();
