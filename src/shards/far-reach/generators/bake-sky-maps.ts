#!/usr/bin/env node
// Offline Sky source catalogue; the real shared encoder remains an authored TS dependency.
import { bakeColourTexture } from '@wildshard/sdk/bake/texture';
import { bakeTextureLibrary } from './bake-sky-world.mjs';

await bakeTextureLibrary(new URL('../../../../', import.meta.url).pathname,
  'src/shards/far-reach/data/skyMapSources.json', { encoder: bakeColourTexture, encode: globalThis.process.argv.includes('--encode'), check: globalThis.process.argv.includes('--check') });
