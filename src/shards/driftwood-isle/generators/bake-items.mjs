import {fileURLToPath} from 'node:url';
import {parseItems} from '@wildshard/format/items';
import {DRIFTWOOD_SWORDS} from './items.ts';
import {byteWriter} from '../../../../scripts/bake-output.mjs';

const writer=byteWriter(process.argv.includes('--check'),'driftwood-isle-items');
writer.put(fileURLToPath(new URL('../data/items.generated.json',import.meta.url)),`${JSON.stringify(parseItems(DRIFTWOOD_SWORDS))}\n`);
writer.finish();
