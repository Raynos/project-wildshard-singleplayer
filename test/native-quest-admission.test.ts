import { expect, test } from 'vitest';
import * as v from 'valibot';
import { output } from '../src/shards/driftwood-isle/generators/output';
import { NativeQuestCompositionSchema } from '../src/format/nativeQuestComposition';
import { readDriftwoodNativeOracle } from './fixtures/driftwood-headless';

test('the fenced native quest oracle keeps complete policy admission before owner installation', async () => {
  expect(output.namedFiles.some(row => row.name === 'sim/headless-assembly.json')).toBe(false);
  const policy = v.parse(NativeQuestCompositionSchema, (await readDriftwoodNativeOracle()).nativeQuest);
  const refuses = (nativeQuest: unknown): void => {
    expect(() => v.parse(NativeQuestCompositionSchema, nativeQuest)).toThrow();
  };
  refuses({ ...policy, acquisition: { ...policy.acquisition, equipment: '' } });
  refuses({ ...policy, bounds: { ...policy.bounds, rows: 65 } });
  refuses({ ...policy, acquisition: { ...policy.acquisition, slot: 32 } });
  refuses({ ...policy, runtimeHook: 'foreign' });
});
