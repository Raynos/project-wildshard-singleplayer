import { resolve } from 'node:path';
import { paintDataMap } from '../../../../scripts/bake-data-maps.mjs';
import { nalatiMapFiles } from './mapAssembly.mjs';

await paintDataMap(resolve(import.meta.dirname, '../../../..'), 'nalati-grasslands', { sources: await nalatiMapFiles() });
