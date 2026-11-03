import { encodeCanonicalJson } from '../../src/sdk/immutable';
import { nativeProgramFixture } from './native-program';

/** Keep typed oracle facts only when a fresh source-fenced child reconstructs
 * their complete canonical wire. No parsed JSON is cast into the parent type.
 * The spec must name the raw constructor and all defining input roots. */
export async function fencedNativeOracle<T>(spec: Parameters<typeof nativeProgramFixture>[0], make: () => T | Promise<T>): Promise<T> {
  const text = await nativeProgramFixture({ ...spec, inputs: [...spec.inputs,
    'test/fixtures/native-oracle.ts', 'test/fixtures/native-program.ts'] });
  const value = await make(), child: unknown = JSON.parse(text);
  if (encodeCanonicalJson(value) !== encodeCanonicalJson(child))
    throw new Error(`Native oracle ${spec.id} differs from its fenced source constructor`);
  return value;
}
