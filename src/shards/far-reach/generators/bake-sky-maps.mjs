#!/usr/bin/env node
// Exact authored source maps through the shared SDK encoder; normal builds derive cheap metadata only.
import { bakeTextureLibrary } from '@wildshard/sdk/bake/texture';

await bakeTextureLibrary(new URL('../../../../', import.meta.url).pathname,
  'src/shards/far-reach/data/skyMapSources.json', { encode: process.argv.includes('--encode'), check: process.argv.includes('--check') });
