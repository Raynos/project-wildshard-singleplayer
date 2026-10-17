// oxlint-disable-next-line import/no-nodejs-modules -- Pine still declares its native ground/navigation by public path.
import { readFileSync } from 'node:fs';
import { PINE_TERRAIN } from '../../src/shards/pine-hollow/data/terrainBindings';
import { headlessModules } from '../../src/shards/pine-hollow/boot/headlessModules';
import { prepareHeadlessAssembly } from '../../src/sdk/headlessAssembly';
import type { PrepareHeadlessRuntime } from '../../src/sdk/headlessRuntime';

/** Lend Pine its actual retained native inputs; no simulation or gameplay owner is replaced. */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = context => prepareHeadlessAssembly({ ...context,
  assets: new Map([...context.assets, ...[PINE_TERRAIN.navmesh, PINE_TERRAIN.terrain].map(path => [path, Uint8Array.from(readFileSync(path))] as const)]) }, headlessModules);
