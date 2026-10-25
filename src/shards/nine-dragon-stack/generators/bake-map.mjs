import { resolve } from 'node:path';
import { paintDataMap } from '../../../../scripts/bake-data-maps.mjs';
import { nineMapFiles } from './mapAssembly.mjs';

await paintDataMap(resolve(import.meta.dirname, '../../../..'), 'nine-dragon-stack', { sources: await nineMapFiles() });
