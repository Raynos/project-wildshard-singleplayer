#!/usr/bin/env node
/// <reference types="node" />
// Offline Sky source catalogue; the real shared encoder remains an authored TS dependency.
// GR5 (G798): a plain script with no catalogue row; it writes the committed data/skyMaps.json from the pinned
// KTX2 assets (--encode re-encodes the sources, --check verifies the committed file). Run it by hand:
// node --experimental-transform-types --import ./src/sdk/bake/source-loader.mjs src/shards/far-reach/generators/bake-sky-maps.ts --check
import { bakeColourTexture } from '@wildshard/sdk/bake/texture';
import { bakeTextureLibrary } from './bake-sky-world.mjs';

await bakeTextureLibrary(new URL('../../../../', import.meta.url).pathname,
  'src/shards/far-reach/data/skyMapSources.json', { encoder: bakeColourTexture, encode: globalThis.process.argv.includes('--encode'), check: globalThis.process.argv.includes('--check') });
