import { expect, test } from 'vitest';
import * as v from 'valibot';
import { output } from '../src/shards/driftwood-isle/generators/output';
import { NativeQuestCompositionSchema } from '@wildshard/format/nativeQuestComposition';
import { driftwoodNativeInputs } from '../src/shards/driftwood-isle/generators/nativeServer';

test('the fenced native quest oracle keeps complete policy admission before owner installation', () => {
  expect(output.namedFiles.some(row => row.name === 'sim/headless-assembly.json')).toBe(false);
  const policy = v.parse(NativeQuestCompositionSchema, driftwoodNativeInputs().nativeQuest);
  const refuses = (nativeQuest: unknown): void => {
    expect(() => v.parse(NativeQuestCompositionSchema, nativeQuest)).toThrow();
  };
  refuses({ ...policy, acquisition: { ...policy.acquisition, equipment: '' } });
  refuses({ ...policy, bounds: { ...policy.bounds, rows: 65 } });
  refuses({ ...policy, acquisition: { ...policy.acquisition, slot: 32 } });
  refuses({ ...policy, runtimeHook: 'foreign' });
});
