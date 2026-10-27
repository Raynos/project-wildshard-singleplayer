import { homedir } from 'node:os';
import { resolve } from 'node:path';
import type { PineSources } from '../../src/shards/pine-hollow/generators/pineSources';
import { readPineSources } from '../../src/shards/pine-hollow/generators/programSources';
import { pineGeneration } from './pine-generation';

// D65: Pine's producers read their committed inputs through the program's sources (`ctx.cached`), as the program does.
/** Pine's sources, read once per test worker over the shared cache. */
export const PINE_SOURCES: PineSources = await readPineSources(pineGeneration('pine-sources-fixture-v1', resolve(homedir(), '.cache/wildshard/gen')));
