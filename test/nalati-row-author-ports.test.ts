import { expect, expectTypeOf, test } from 'vitest';
import * as v from 'valibot';
import { actorProjectionRows } from '../src/sdk/decisionScripts';
import { authorFormatSchema, authorFormatRows } from '../src/sdk/formatJsonSchema';
import type { TreeSetSchema } from '../src/format/treeSetRows';
import { MountedSpecimenSeatSchema } from '../src/format/mountedSpecimenRows';
import { ClientRidingSessionSchema } from '../src/format/riding';
import { parseActorProjectionV2 } from '../src/format/actorProjectionV2';
import type { CreatureGuestRows } from '../src/format/speciesBookRows';
import type { TREE_SET } from '../src/shards/nalati-grasslands/generators/treeSet';
import type { nalatiMountedFigure } from '../src/shards/nalati-grasslands/generators/mountedFigure';
import type { nalatiRidingSession } from '../src/shards/nalati-grasslands/generators/clientRiding';
import type { actorProjection } from '../src/shards/nalati-grasslands/generators/actorProjection';
import { nalatiActorAuthorRows, nalatiRowAuthorObservation } from './fixtures/nalati-row-author-observation';
import original from './fixtures/nalati-row-author-original.json' with { type: 'json' };

function refusal(run: () => unknown): unknown {
  try { return { rows: run() }; }
  catch (error) {
    if (error instanceof v.ValiError) return { issues: error.issues };
    if (error instanceof Error) return { name: error.name, message: error.message };
    throw error;
  }
}

test('Nalati author ports retain complete native types and defining schema identities', () => {
  expectTypeOf<typeof TREE_SET>().toEqualTypeOf<v.InferOutput<typeof TreeSetSchema>>();
  expectTypeOf<ReturnType<typeof nalatiMountedFigure>>().toEqualTypeOf<v.InferOutput<typeof MountedSpecimenSeatSchema>>();
  expectTypeOf<ReturnType<typeof nalatiRidingSession>>().toEqualTypeOf<v.InferOutput<typeof ClientRidingSessionSchema>>();
  expectTypeOf<Parameters<typeof actorProjection>[0]>().toEqualTypeOf<CreatureGuestRows>();
  expectTypeOf<ReturnType<typeof actorProjection>>().toEqualTypeOf<ReturnType<typeof parseActorProjectionV2>>();
  expect(authorFormatSchema('mountedSpecimenRows.MountedSpecimenSeatSchema')).toBe(MountedSpecimenSeatSchema);
  expect(authorFormatSchema('riding.ClientRidingSessionSchema')).toBe(ClientRidingSessionSchema);
});

test('actor admission retains JSON, ABI2 and declared signal/field/channel refusals', () => {
  const rows = nalatiActorAuthorRows(), step = rows.step;
  if (step === undefined) throw new Error('Missing original actor step');
  expect(actorProjectionRows(rows)).toEqual(parseActorProjectionV2(rows));
  let reads = 0;
  const getter = { get program() { reads++; return rows.program; } };
  const invalid: unknown[] = [null, getter, { ...rows, program: { ...rows.program, v2: undefined } },
    { ...rows, step: { ...step, signal: 'unadmitted' } },
    { ...rows, step: { ...step, columns: [{ id: 1, name: 'unadmitted', source: { kind: 'actor', field: 'x' } }] } },
    { ...rows, step: { ...step, operations: [{ kind: 'memory', key: 'test', value: { kind: 'channel', name: 'unadmitted' } }] } }];
  for (const value of invalid) {
    expect(refusal(() => actorProjectionRows(value))).toEqual(refusal(() => parseActorProjectionV2(value)));
    expect(() => actorProjectionRows(value)).toThrow();
  }
  expect(reads).toBe(0);
  for (const value of [null, {}, { mount: '' }]) {
    expect(refusal(() => authorFormatRows('mountedSpecimenRows.MountedSpecimenSeatSchema', value)))
      .toEqual(refusal(() => v.parse(MountedSpecimenSeatSchema, value)));
    expect(refusal(() => authorFormatRows('riding.ClientRidingSessionSchema', value)))
      .toEqual(refusal(() => v.parse(ClientRidingSessionSchema, value)));
  }
});

test('all four complete original author wires retain their bytes and order', () => {
  expect(nalatiRowAuthorObservation()).toEqual(original);
});
