// oxlint-disable-next-line import/no-nodejs-modules -- The author API must keep the original fresh Node renderer guard.
import { execFileSync } from 'node:child_process';
import { expect, expectTypeOf, test } from 'vitest';
import * as v from 'valibot';
import { questPropRows, questAutomaticFlag } from '../src/sdk/quests';
import { NativeQuestPropsSchema } from '../src/format/questInteractions';
import { autoFlag, type InteractDef, type Cond } from '../src/engine/world/interact/types';
import { DRIFTWOOD_INTERACT } from '../src/shards/driftwood-isle/generators/interactables';
import { NATIVE_QUEST_PROPS, NATIVE_FLOORS, NATIVE_BARRELS, NATIVE_PLATES, NATIVE_WATER } from '../src/shards/driftwood-isle/generators/nativeQuestProps';
import { hashImmutableBytes } from '../src/sdk/immutable';
import original from './fixtures/quest-prop-author-original.json' with { type: 'json' };

test('all native automatic flags retain their exact key and absence policy', () => {
  for (const row of DRIFTWOOD_INTERACT.rows) expect(questAutomaticFlag(row)).toBe(autoFlag(row));
  const kinds: readonly InteractDef['kind'][] = ['chest', 'door', 'key', 'pickup', 'lever', 'plate', 'beacon', 'bench', 'altar', 'barrel'];
  expect(kinds.map(kind => questAutomaticFlag({ kind, id: 'own:item' }))).toEqual([
    'open:own:item', 'open:own:item', 'taken:own:item', 'taken:own:item', 'lever:own:item',
    'plate:own:item', 'lit:own:item', 'used:own:item', 'used:own:item', null,
  ]);
  expectTypeOf<Parameters<typeof questAutomaticFlag>[0]>().toEqualTypeOf<Pick<InteractDef, 'kind' | 'id'>>();
});

test('complete physical quest facts preserve the original pin and full condition/schema types', () => {
  expectTypeOf<ReturnType<typeof questPropRows>>().toEqualTypeOf<v.InferOutput<typeof NativeQuestPropsSchema>>();
  expectTypeOf<typeof NATIVE_PLATES[number]['when']>().toEqualTypeOf<Cond | undefined>();
  const bytes = new TextEncoder().encode(JSON.stringify({ NATIVE_QUEST_PROPS, NATIVE_FLOORS, NATIVE_BARRELS, NATIVE_PLATES, NATIVE_WATER }));
  expect({ bytes: bytes.byteLength, hash: hashImmutableBytes(bytes) }).toEqual(original);
  expect(questPropRows(NATIVE_QUEST_PROPS)).toEqual(v.parse(NativeQuestPropsSchema, NATIVE_QUEST_PROPS));
  for (const input of [{ ...NATIVE_QUEST_PROPS, extra: true }, { ...NATIVE_QUEST_PROPS, floors: [{ x: 0, z: 0, step: 0, width: 1, height: 1, values: [0] }] }]) {
    expect(() => questPropRows(input)).toThrow(); expect(() => v.parse(NativeQuestPropsSchema, input)).toThrow();
  }
});

test('quest author admission executes in native Node without a physical or renderer owner', () => {
  const source = `import {questPropRows,questAutomaticFlag} from './src/sdk/quests.ts';
    console.log(JSON.stringify({rows:questPropRows({floors:[],gates:[]}),flag:questAutomaticFlag({kind:'door',id:'gate'})}));`;
  const result = execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e', source], { encoding: 'utf8', timeout: 30_000 });
  expect(JSON.parse(result)).toEqual({ rows: { floors: [], gates: [], drops: [], bodies: [] }, flag: 'open:gate' });
});
