import { prepareHeadlessAssembly } from '../../src/sdk/headlessAssembly';
import { headlessModules } from '../../src/shards/nalati-grasslands/boot/headlessModules';
import type { PrepareHeadlessRuntime } from '../../src/sdk/headlessRuntime';

/** Native preparation uses admitted data and the checked static catalogue. */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = context => prepareHeadlessAssembly(context, headlessModules);
