import { resolve } from 'node:path';
import { paintDataMap, repoSource } from '../../../../scripts/bake-data-maps.mjs';
import { nalatiMapFiles } from './mapAssembly.mjs';

const root = resolve(import.meta.dirname, '../../../..');
await paintDataMap(root, 'nalati-grasslands', { sources: await nalatiMapFiles(repoSource(root)) });
