import { fencedNativeOracle } from './native-oracle';
import type { nalatiNativeAssemblyInputs } from './nalati-native-assembly-inputs';

import type { NativeProgramSpec } from './native-program';

/** Defining complete constructor specification used by the native input publisher. */
export const NALATI_NATIVE_ASSEMBLY_SPEC: NativeProgramSpec = { id: 'nalati-native-assembly', transformTypes: true, loader: 'simulation', script: 'test/fixtures/nalati-native-assembly-compile.mjs',
    inputs: ['src/engine', 'src/game', 'src/sdk', 'src/sharddev', 'src/commons', 'src/shards/nalati-grasslands',
      'public/assets/baked/nalati-grasslands/terrain.bin', 'package.json', 'pnpm-lock.yaml',
      'test/fixtures/nalati-native-assembly.ts', 'test/fixtures/nalati-native-assembly-inputs.ts',
      'test/fixtures/nalati-native-place-files.ts', 'test/fixtures/nalati-native-places-compile.mjs',
      'test/fixtures/nalati-place-wires.json', 'test/fixtures/nalati-places-original.json',
      'test/fixtures/nalati-admission.ts', 'test/fixtures/nalati-admission-original.json',
      'test/fixtures/nalati-admission-original.wasm', 'test/fixtures/nalati-admission-witness-original.bin',
      'test/fixtures/nalati-titan.ts', 'test/fixtures/nalati-titan-compile.mjs', 'test/fixtures/nalati-native-program.ts', 'test/fixtures/runSnapshot.ts'],
  };

/** Select only this Nalati constructor's published input cache. */
export function nalatiNativeAssemblySpec(): NativeProgramSpec {
  const cacheDir = process.env['WS_NALATI_NATIVE_CACHE'];
  return {...NALATI_NATIVE_ASSEMBLY_SPEC, ...(cacheDir === undefined || cacheDir === '' ? {} : {cacheDir})};
}

/** Retain the complete original native oracle after its production policies
 * move to their defining entered owners. Every constructor input is fenced. */
export function nalatiNativeAssembly(): Promise<ReturnType<typeof nalatiNativeAssemblyInputs>> {
  return fencedNativeOracle(nalatiNativeAssemblySpec(), async () => (await import('./nalati-native-assembly-inputs')).nalatiNativeAssemblyInputs());
}
