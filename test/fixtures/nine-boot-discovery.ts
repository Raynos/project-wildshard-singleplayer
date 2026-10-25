// oxlint-disable-next-line import/no-nodejs-modules -- Bind only the author project's explicit public input root.
import { resolve } from 'node:path';
import { createProjectGeneration } from '../../src/sdk/projectGeneration';
import { nineBootProgram } from '../../src/shards/nine-dragon-stack/generators/bootDiscovery';

/** Actual source operation using current presence facts; creates no intermediate output or cache entry. */
export const bootDiscovery = nineBootProgram(createProjectGeneration(resolve('src/shards/nine-dragon-stack'), 'f'.repeat(64), new Map(),
  resolve('tmp/nine-boot-inventory'), [{ prefix: '/assets/', directory: resolve('public/assets') }]));
