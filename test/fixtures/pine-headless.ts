// oxlint-disable-next-line import/no-nodejs-modules -- Pine still declares its native ground/navigation by public path.
import { readFileSync } from 'node:fs';
import { PINE_NAVMESH_ASSET, PINE_TERRAIN_ASSET, prepareHeadlessRuntime as preparePine } from '../../src/shards/pine-hollow/runtime/headless';
import type { PrepareHeadlessRuntime } from '../../src/sdk/headlessRuntime';

/** Lend Pine its actual retained native inputs; no simulation or gameplay owner is replaced. */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = context => preparePine({ ...context,
  assets: new Map([...context.assets, ...[PINE_NAVMESH_ASSET, PINE_TERRAIN_ASSET].map(path => [path, Uint8Array.from(readFileSync(path))] as const)]) });
