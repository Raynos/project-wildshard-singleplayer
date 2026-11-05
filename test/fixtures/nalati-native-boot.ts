import { fencedNativeOracle } from './native-oracle';
import type { nalatiNativeBootInputs } from './nalati-native-boot-inputs';

import type { NativeProgramSpec } from './native-program';

/** Defining complete constructor specification used by the native input publisher. */
export const NALATI_NATIVE_BOOT_SPEC: NativeProgramSpec = { id: 'nalati-native-boot', loader: 'simulation', script: 'test/fixtures/nalati-native-boot-compile.mjs',
    inputs: ['src/engine', 'src/game', 'src/sdk', 'src/sharddev', 'src/commons',
      'src/shards/nalati-grasslands', 'package.json', 'pnpm-lock.yaml',
      'test/fixtures/nalati-native-boot.ts', 'test/fixtures/nalati-native-boot-inputs.ts',
      'test/fixtures/nalati-admission.ts', 'test/fixtures/nalati-admission-original.json',
      'test/fixtures/nalati-admission-original.wasm', 'test/fixtures/nalati-admission-witness-original.bin',
      'test/fixtures/nalati-riding.ts', 'test/fixtures/nalati-riding-compile.mjs', 'test/fixtures/nalati-titan.ts', 'test/fixtures/nalati-titan-compile.mjs',
      'test/fixtures/nalati-native-program.ts', 'test/fixtures/runSnapshot.ts'],
  };

/** Select only this Nalati constructor's published input cache. */
export function nalatiNativeBootSpec(): NativeProgramSpec {
  const cacheDir = process.env['WS_NALATI_NATIVE_CACHE'];
  return {...NALATI_NATIVE_BOOT_SPEC, ...(cacheDir === undefined || cacheDir === '' ? {} : {cacheDir})};
}

/** Exact independent native oracle, admitted only after a fresh source-fenced
 * constructor reproduces its complete original canonical value. */
export function nalatiNativeBoot(): Promise<ReturnType<typeof nalatiNativeBootInputs>> {
  return fencedNativeOracle(nalatiNativeBootSpec(), async () => (await import('./nalati-native-boot-inputs')).nalatiNativeBootInputs());
}
