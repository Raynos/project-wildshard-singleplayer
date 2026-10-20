// oxlint-disable-next-line import/no-nodejs-modules -- Pine still declares its native ground/navigation by public path.
import { readFileSync } from 'node:fs';
import PINE_TERRAIN from '../../src/shards/pine-hollow/data/terrainBindings.json' with { type: 'json' };
// oxlint-disable-next-line import/no-nodejs-modules -- Native proof capabilities are generated outside source and play products.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Only the checked local proof module is a trusted entry.
import { pathToFileURL } from 'node:url';
import { generateHeadlessModuleMap } from '../../scripts/check-headless-assemblies.mjs';
import { prepareHeadlessAssembly, type HeadlessAssemblyModules } from '../../src/sdk/headlessAssembly';
import type { PrepareHeadlessRuntime } from '../../src/sdk/headlessRuntime';

const entry = pathToFileURL(generateHeadlessModuleMap(resolve(import.meta.dirname, '../..'), 'pine-hollow')).href;
// Load capabilities before the witness fingerprints its complete module graph.
const loaded: unknown = await import(/* @vite-ignore */ entry);
function hasCapabilities(value: unknown): value is { readonly headlessModules: HeadlessAssemblyModules } {
  if (value === null || typeof value !== 'object' || !('headlessModules' in value)) return false;
  const modules: unknown = value.headlessModules;
  return modules !== null && typeof modules === 'object' && !Array.isArray(modules)
    && Object.values(modules).every((module: unknown) => module !== null && typeof module === 'object' && !Array.isArray(module));
}
if (!hasCapabilities(loaded)) throw new Error('Missing checked Pine proof capabilities');
const modules = loaded.headlessModules;

/** Lend Pine its actual retained native inputs; no simulation or gameplay owner is replaced. */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = context => prepareHeadlessAssembly({ ...context,
  assets: new Map([...context.assets, ...[PINE_TERRAIN.navmesh, PINE_TERRAIN.terrain].map(path => [path, Uint8Array.from(readFileSync(path))] as const)]) }, modules);
