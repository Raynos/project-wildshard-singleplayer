import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { fencedNativeOracle } from './fixtures/native-oracle';
import { nineNativeOracle, NINE_NATIVE_ORACLE } from './fixtures/nine-native-oracle';
import { nineNativeOracleInputs } from './fixtures/nine-native-oracle-inputs';

test('the fenced typed Nine oracle retains the complete former shipping wire', async () => {
  const wire = new TextEncoder().encode(JSON.stringify(await nineNativeOracle()));
  expect(wire.byteLength).toBe(731);
  expect(hashImmutableBytes(wire)).toBe('0316e2deaa4976a3a3b232f6aeb0bccac20bef74559f3af4e42411e6cca8a117');
});

test('a divergent cached parent cannot supply native policy facts', async () => {
  await expect(fencedNativeOracle(NINE_NATIVE_ORACLE, () => {
    const rows = nineNativeOracleInputs(); rows.constants.jianPolicy.eye += 1; return rows;
  })).rejects.toThrow('differs from its fenced source constructor');
});
