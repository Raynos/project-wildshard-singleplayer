import { resolve } from 'node:path';
import { templateMapInputs } from './mapInputs.ts';
import { paintDataMap } from '../../../../scripts/bake-data-maps.mjs';

await paintDataMap(resolve(import.meta.dirname, '../../../..'), '_template', { sources: templateMapInputs() });
