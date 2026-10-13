import { expect, it } from 'vitest';
import * as v from 'valibot';
import { NpcRowSchema, NpcDialogueRowSchema, NpcMotionSchema, parseNpcRow } from '@wildshard/format/npcs';
import { NpcRowSchema as RuntimeSchema, NpcDialogueRowSchema as RuntimeDialogue, NpcMotionSchema as RuntimeMotion } from '@wildshard/game/plugin/quests';
import { parseNpcRow as parseAuthor } from '@wildshard/sdk/questGraph';
import { NpcRowSchema as ReleasedSchema } from './fixtures/npc-released';
import { KEEPER_ROW } from '../src/shards/far-reach/data/keeperLook';
import { SCOUT_ROW } from '../src/shards/sunscar-dunes/data/questPresentation';
import { formatJsonSchemas } from '../src/sdk/formatJsonSchema';

function result(schema: v.GenericSchema, input: unknown): string {
  const parsed = v.safeParse(schema, input);
  return JSON.stringify(parsed.success ? { success: true, output: parsed.output } : { success: false,
    issues: parsed.issues.map(issue => ({ kind: issue.kind, type: issue.type, message: issue.message,
      path: issue.path?.map(part => part.key) })) });
}

it('shares the defining format schema identities with every retained runtime binding', () => {
  expect(RuntimeSchema).toBe(NpcRowSchema);
  expect(RuntimeDialogue).toBe(NpcDialogueRowSchema);
  expect(RuntimeMotion).toBe(NpcMotionSchema);
  for (const row of [KEEPER_ROW, SCOUT_ROW]) {
    expect(JSON.stringify(parseNpcRow(row))).toBe(JSON.stringify(v.parse(ReleasedSchema, row)));
    expect(parseAuthor(row)).toStrictEqual(parseNpcRow(row));
  }
});

it('retains admission, optional fields, bounds and ordered errors for both NPC families', () => {
  for (const row of [KEEPER_ROW, SCOUT_ROW]) {
    const { motion: _motion, ...withoutMotion } = parseNpcRow(row);
    const corpus: unknown[] = [row, withoutMotion, null, [], { ...row, unknown: true },
      { ...row, dialogue: [] }, { ...row, dialogue: [{ lines: [] }] },
      { ...row, figure: { ...row.figure, roughness: 1.01 } },
      { ...row, collider: { half: 1, below: 0, above: 2, surface: 'stone' } }];
    for (const value of [-Infinity, -1, 0, 1, Infinity, Number.NaN, '0', null, undefined]) {
      corpus.push({ ...row, talkHeight: value }, { ...row, at: { x: value, z: 0 } });
    }
    for (const length of [0, 1, 96, 97]) corpus.push({ ...row, id: 'x'.repeat(length) });
    for (const length of [0, 1, 400, 401]) corpus.push({ ...row, name: 'x'.repeat(length) });
    for (const input of corpus) expect(result(NpcRowSchema, input)).toBe(result(ReleasedSchema, input));
  }
});

it('publishes structural JSON Schema for the defining NPC, motion and dialogue roots', () => {
  const schemas = formatJsonSchemas();
  for (const name of ['NpcRow', 'NpcMotion', 'NpcDialogueRow']) {
    expect(schemas[`npcs.${name}`]?.additionalProperties).toBe(false);
    expect(schemas[`npcs.${name}`]?.title).toBe(`npcs.${name}`);
  }
  expect(JSON.stringify(schemas['npcs.NpcRow'])).toContain('"maxLength":96');
  expect(JSON.stringify(schemas['npcs.NpcRow'])).toContain('"maximum":1');
});
