import { resolve } from 'node:path';
import { paintDataMap } from '../../../../scripts/bake-data-maps.mjs';
import { pineScriptSources } from './scriptSources.mjs';
import { pineMapFiles } from './mapAssembly.mjs';

// the map assembly's files from the pure producer over Pine's program sources (the retired pine-map-assembly job's)
await paintDataMap(resolve(import.meta.dirname, '../../../..'), 'pine-hollow', { sources: await pineMapFiles(await pineScriptSources('pine-data-map')) });
