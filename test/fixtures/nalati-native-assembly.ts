import { fencedNativeOracle } from './native-oracle';
import { nalatiNativeAssemblyInputs } from './nalati-native-assembly-inputs';

/** Retain the complete original native oracle after its production policies
 * move to their defining entered owners. Every constructor input is fenced. */
export function nalatiNativeAssembly(): Promise<ReturnType<typeof nalatiNativeAssemblyInputs>> {
  return fencedNativeOracle({ id: 'nalati-native-assembly', transformTypes: true, loader: 'simulation', script: 'test/fixtures/nalati-native-assembly-compile.mjs',
    inputs: ['src/engine', 'src/format', 'src/game', 'src/sdk', 'src/commons', 'src/shards/nalati-grasslands',
      'public/assets/baked/nalati-grasslands/terrain.bin', 'package.json', 'pnpm-lock.yaml',
      'test/fixtures/nalati-native-assembly.ts', 'test/fixtures/nalati-native-assembly-inputs.ts',
      'test/fixtures/nalati-native-place-files.ts', 'test/fixtures/nalati-place-wires.json',
      'test/fixtures/nalati-admission.ts', 'test/fixtures/nalati-admission-original.json',
      'test/fixtures/nalati-admission-original.wasm', 'test/fixtures/nalati-admission-witness-original.bin',
      'test/fixtures/nalati-titan.ts', 'test/fixtures/nalati-native-program.ts', 'test/fixtures/runSnapshot.ts'],
  }, nalatiNativeAssemblyInputs);
}
