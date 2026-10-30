import { nativeCompilers } from './nativeCompilers';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the fixture's existing native production cache root.
import {homedir} from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the fixture's explicit production input roots.
import {resolve} from 'node:path';
import {createProjectGeneration} from '../../src/sdk/projectGeneration';
import {hashImmutableBytes} from '../../src/sdk/immutable';
import type {Shardfile} from '../../src/sdk/shardfile';
import build from '../../src/shards/driftwood-isle/shard.config';
import {runSnapshot} from './runSnapshot';

const project = 'src/shards/driftwood-isle';
const inputs = [{prefix:'/src/shards/driftwood-isle/',directory:project},
  {prefix:'/assets/',directory:resolve('public/assets')}];
/** The declaration admitted by Driftwood's real source program over its CLI input roots (CI7: once per CI run). */
export const DRIFTWOOD: Shardfile = await runSnapshot('driftwood-program', () => {
  const context = createProjectGeneration(project,hashImmutableBytes(new TextEncoder().encode('driftwood-program-fixture-v1')),
    new Map(),resolve(homedir(),'.cache/wildshard/gen'),inputs);
  return build({ ...context, ...nativeCompilers });
});
