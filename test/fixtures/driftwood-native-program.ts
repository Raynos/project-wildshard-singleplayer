import { nativeProgramFixture } from './native-program';

// The complete executable/asset roots and installed compiler identities of the
// existing guest constructor. Parsers and all consumer assertions stay outside.
const inputs = ['src/engine', 'src/format', 'src/game', 'src/sdk', 'src/commons',
  'src/shards/driftwood-isle', 'package.json', 'pnpm-lock.yaml',
  'node_modules/assemblyscript/package.json', 'node_modules/binaryen/package.json',
  'node_modules/@typescript/typescript6/package.json', 'scripts/bake-loader.mjs',
  'test/fixtures/native-program.ts', 'test/fixtures/driftwood-native-program.ts'];

/** Original native guest construction, coalesced and byte-verified per source/host. */
export function driftwoodNativeGuestProgram(): Promise<string> {
  return nativeProgramFixture({ id: 'driftwood-guest', script: 'test/fixtures/driftwood-guest-compile.mjs', inputs, transformTypes: true });
}
