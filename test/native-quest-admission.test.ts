import { expect, test } from 'vitest';
import * as v from 'valibot';
import { output } from '../src/shards/driftwood-isle/generators/output';
import { NativeQuestCompositionSchema } from '../src/format/nativeQuestComposition';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';

test('native quest policy is admitted inside the existing headless product before owner installation', () => {
  const file = output.namedFiles.find(row => row.name === 'sim/headless-assembly.json');
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (file === undefined || bytes === undefined || file.jsonSchema === undefined) throw new Error('Missing native policy admission');
  const assembly = v.parse(v.looseObject({ constants: v.looseObject({ nativeQuest: NativeQuestCompositionSchema }) }), validateNamedJsonSchema(file.jsonSchema, bytes));
  const jsonSchema = file.jsonSchema, policy = assembly.constants.nativeQuest;
  const refuses = (nativeQuest: unknown): void => {
    const input = { ...assembly, constants: { ...assembly.constants, nativeQuest } };
    expect(() => validateNamedJsonSchema(jsonSchema, new TextEncoder().encode(JSON.stringify(input)))).toThrow('refuses its schema');
  };
  refuses({ ...policy, acquisition: { ...policy.acquisition, equipment: '' } });
  refuses({ ...policy, bounds: { ...policy.bounds, rows: 65 } });
  refuses({ ...policy, acquisition: { ...policy.acquisition, slot: 32 } });
  refuses({ ...policy, runtimeHook: 'foreign' });
});
