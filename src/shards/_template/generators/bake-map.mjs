import { resolve } from 'node:path';
import { paintDataMap } from '../../../../scripts/bake-data-maps.mjs';

await paintDataMap(resolve(import.meta.dirname, '../../../..'), '_template');
