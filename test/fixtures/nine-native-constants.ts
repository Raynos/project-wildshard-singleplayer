import { fencedNativeOracle } from './native-oracle';
import { nineNativeConstantsInputs } from './nine-native-constants-inputs';

/** Complete original direct native inputs, admitted against a fresh fenced
 * constructor after production policies enter their actual typed owners. */
export function nineNativeConstants(): Promise<ReturnType<typeof nineNativeConstantsInputs>> {
  return fencedNativeOracle({ id: 'nine-native-constants', transformTypes: true, script: 'test/fixtures/nine-native-constants-compile.mjs',
    inputs: ['src/engine', 'src/game', 'src/sdk', 'src/sharddev', 'src/commons', 'src/shards/nine-dragon-stack',
      'package.json', 'pnpm-lock.yaml', 'test/fixtures/nine-native-constants.ts', 'test/fixtures/nine-native-constants-inputs.ts'],
  }, nineNativeConstantsInputs);
}
