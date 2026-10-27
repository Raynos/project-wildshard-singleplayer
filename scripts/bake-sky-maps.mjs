#!/usr/bin/env node
// Offline Sky library map metadata (GR5, G798): a plain script with no catalogue row. It writes the committed
// src/shards/far-reach/data/skyMaps.json from the pinned KTX2 assets (--encode re-encodes the sources, --check verifies
// the committed file); it lives here, not in the shard, because it reads its own command line. Run it by hand:
// node --import ./scripts/bake-loader.mjs scripts/bake-sky-maps.mjs --check
import { bakeColourTexture } from '@wildshard/sdk/bake/texture';
import { bakeTextureLibrary } from '../src/shards/far-reach/generators/bake-sky-world.mjs';

await bakeTextureLibrary(new URL('../', import.meta.url).pathname,
  'src/shards/far-reach/data/skyMapSources.json', { encoder: bakeColourTexture, encode: process.argv.includes('--encode'), check: process.argv.includes('--check') });
