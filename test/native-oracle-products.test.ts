import { expect, test } from 'vitest';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import scaffold from '../src/shards/driftwood-isle/data/headlessAssembly.json' with { type: 'json' };
import { readDriftwoodNativeOracle } from './fixtures/driftwood-headless';
import { pineNativeOracleSpec } from './fixtures/pine-native-oracle-spec';
import { pineNativeOracleInputs } from './fixtures/pine-native-oracle-inputs';
import { fencedNativeOracle } from './fixtures/native-oracle';

test('the fenced Pine oracle retains every former shipping fact byte', async () => {
  const bytes = new TextEncoder().encode(encodeCanonicalJson({ constants: await fencedNativeOracle(pineNativeOracleSpec(), pineNativeOracleInputs) }));
  expect(bytes.byteLength).toBe(64_095);
  expect(hashImmutableBytes(bytes)).toBe('5e6a851d41c1b82dd61558c6ac4cd2b7701954f1cc3869d37991feabff5513b2');
});

test('the fenced Driftwood oracle retains every former shipping fact byte', async () => {
  // The inert old scaffold is only a byte oracle, never an executable selector.
  const bytes = new TextEncoder().encode(encodeCanonicalJson({ ...scaffold, constants: await readDriftwoodNativeOracle() }));
  expect(bytes.byteLength).toBe(912_509);
  expect(hashImmutableBytes(bytes)).toBe('fea70e3051c7594cdd97c1a32f214a3ba57de1ba7a950dd16a808215b41af31e');
});


test('a restored Pine construction cannot lend divergent typed terrain facts',async()=>{
  await expect(fencedNativeOracle(pineNativeOracleSpec(),()=>{
    const rows=pineNativeOracleInputs();rows.terrain.res-=1;return rows;
  })).rejects.toThrow('differs from its fenced source constructor');
});
