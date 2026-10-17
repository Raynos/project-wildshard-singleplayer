import { prepareHeadlessAssembly } from '../../src/sdk/headlessAssembly';
import { headlessModules } from '../../src/shards/driftwood-isle/boot/headlessModules';
import type { PrepareHeadlessRuntime } from '../../src/sdk/headlessRuntime';

/** Explicit trusted static capabilities; assembly and all gameplay rows come from the built product. */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = context => prepareHeadlessAssembly(context, headlessModules);
