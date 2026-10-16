import {fileURLToPath} from 'node:url';
import {parseItems} from '@wildshard/format/items';
import {PINE_ITEMS} from './items.ts';
import {byteWriter} from '../../../../scripts/bake-output.mjs';

const writer=byteWriter(process.argv.includes('--check'),'pine-hollow-items');
writer.put(fileURLToPath(new URL('../data/items.generated.json',import.meta.url)),`${JSON.stringify(parseItems(PINE_ITEMS))}\n`);
writer.finish();
