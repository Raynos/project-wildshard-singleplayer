import { prepareHeadlessRuntime } from '../../fixtures/nine-headless.ts';
// Plain Node grid admission and durable regional continuation through the same direct native proof factory.
// Nine Dragon Stack's cell is the dev server's (catalogue `devserver`), so it admits in that grid mode.
import source from '../../../src/shards/nine-dragon-stack/generators/product.ts';
import { proveTrustedGridReady } from '../compatibility/gridReady.mjs';

console.info(JSON.stringify(await proveTrustedGridReady(source, { developer: false, devserver: true }, prepareHeadlessRuntime)));
