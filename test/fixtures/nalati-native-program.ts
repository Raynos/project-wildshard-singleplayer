import { nativeProgramFixture } from './native-program';
import * as v from 'valibot';

/** Every executable/declaration layer the native compiler/scalar helpers can
 * import, including loose source inventory, plus actual installed tool versions.
 * The fixture adapters/parsers and cold product tests remain independent. */
const inputs = ['src/engine', 'src/format', 'src/game', 'src/sdk', 'src/commons',
  'src/shards/nalati-grasslands', 'package.json', 'pnpm-lock.yaml',
  'node_modules/assemblyscript/package.json', 'node_modules/binaryen/package.json',
  'node_modules/@typescript/typescript6/package.json', 'scripts/bake-loader.mjs',
  'test/fixtures/native-program.ts', 'test/fixtures/nalati-native-program.ts'];

/** One source/host-keyed construction per helper, shared across isolated suites. */
export function nalatiNativeProgram(name: 'kokpar' | 'titan' | 'riding' | 'charge' | 'geography'): Promise<string> {
  return nativeProgramFixture({ id: `nalati-${name}`, script: `test/fixtures/nalati-${name}-compile.mjs`, inputs });
}

/** Fresh owned current scalar loans for isolated setup; no cached game state. */
export async function nalatiNativeGeography(): Promise<ReadonlyMap<string, Uint8Array>> {
  const rows = v.parse(v.array(v.tuple([v.string(), v.string()])), JSON.parse(await nalatiNativeProgram('geography')));
  const files = new Map(rows.map(([name, data]) => [name, Uint8Array.from(Buffer.from(data, 'base64'))]));
  if (files.size !== rows.length) throw new Error('Duplicate native geography file');
  return files;
}
