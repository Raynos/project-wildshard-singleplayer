import { fencedNativeOracle } from './native-oracle';
import { nalatiNativeBootInputs } from './nalati-native-boot-inputs';

/** Exact independent native oracle, admitted only after a fresh source-fenced
 * constructor reproduces its complete original canonical value. */
export function nalatiNativeBoot(): Promise<ReturnType<typeof nalatiNativeBootInputs>> {
  return fencedNativeOracle({ id: 'nalati-native-boot', loader: 'simulation', script: 'test/fixtures/nalati-native-boot-compile.mjs',
    inputs: ['src/engine', 'src/format', 'src/game', 'src/sdk', 'src/commons',
      'src/shards/nalati-grasslands', 'package.json', 'pnpm-lock.yaml',
      'test/fixtures/nalati-native-boot.ts', 'test/fixtures/nalati-native-boot-inputs.ts',
      'test/fixtures/nalati-admission.ts', 'test/fixtures/nalati-admission-original.json',
      'test/fixtures/nalati-admission-original.wasm', 'test/fixtures/nalati-admission-witness-original.bin',
      'test/fixtures/nalati-riding.ts', 'test/fixtures/nalati-titan.ts',
      'test/fixtures/nalati-native-program.ts', 'test/fixtures/runSnapshot.ts'],
  }, nalatiNativeBootInputs);
}
