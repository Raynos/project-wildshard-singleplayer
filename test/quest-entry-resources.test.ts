import { expect, test } from 'vitest';
import * as v from 'valibot';
import { QuestPageSchema } from '../src/format/questPageComposition';
import { parseQuestWorldDocument } from '../src/format/questWorld';
import { parseQuestFiguresDocument } from '../src/format/questFigures';
import { parseQuestContinuationDocument } from '../src/format/questContinuation';
import { driftwoodJsonBlob } from '../src/shards/driftwood-isle/generators/namedSchemas';
import { driftwoodQuestWorld } from '../src/shards/driftwood-isle/generators/questWorld';
import { driftwoodQuestFigures } from '../src/shards/driftwood-isle/generators/questFigures';
import page from '../src/shards/driftwood-isle/data/questPageComposition.json' with { type: 'json' };
import frames from '../src/shards/driftwood-isle/data/questFrames.json' with { type: 'json' };
import events from '../src/shards/driftwood-isle/data/questEvents.json' with { type: 'json' };
import deaths from '../src/shards/driftwood-isle/data/questDeaths.json' with { type: 'json' };
import continuation from '../src/shards/driftwood-isle/data/questContinuation.json' with { type: 'json' };
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';

function document() {
  return { ...page, frames, events, deaths: deaths.page, entryResources: {
    world: driftwoodQuestWorld(), figures: driftwoodQuestFigures(), continuation,
  } };
}
test('the defining page admits the original resource values without new document names', () => {
  const rows = v.parse(QuestPageSchema, document());
  const blob = driftwoodJsonBlob('quests/page-composition.json', 'json', new TextEncoder().encode(JSON.stringify(rows)));
  if (blob.file.jsonSchema === undefined) throw new Error('Missing page schema');
  const admitted = validateNamedJsonSchema(blob.file.jsonSchema, blob.bytes);
  expect(parseQuestWorldDocument(admitted)).toEqual(driftwoodQuestWorld());
  expect(parseQuestFiguresDocument(admitted)).toEqual(driftwoodQuestFigures());
  expect(parseQuestContinuationDocument(admitted)).toEqual(continuation);
  expect(parseQuestWorldDocument(driftwoodQuestWorld())).toEqual(driftwoodQuestWorld());
  expect(parseQuestFiguresDocument(driftwoodQuestFigures())).toEqual(driftwoodQuestFigures());
  expect(parseQuestContinuationDocument(continuation)).toEqual(continuation);
});
test('fixed resource readers refuse unknown selectors, malformed facts and accessor rows', () => {
  const rows = document();
  for (const world of [{ owner: 'world', path: ['anchors'] }, { ...rows.entryResources.world, pois: { hut: { anchors: { a: { x: Infinity, y: 0, z: 0, yaw: 0 } } } } }])
    expect(() => parseQuestWorldDocument({ ...rows, entryResources: { ...rows.entryResources, world } })).toThrow();
  expect(() => v.parse(QuestPageSchema, { ...rows, entryResources: { ...rows.entryResources, selector: ['world'] } })).toThrow();
  expect(() => parseQuestFiguresDocument({ ...rows, entryResources: { ...rows.entryResources, figures: { figures: [{ draw: () => undefined }] } } })).toThrow();
  expect(() => parseQuestContinuationDocument({ ...rows, entryResources: { ...rows.entryResources, continuation: { ...continuation, loot: { ...continuation.loot, before: [1] } } } })).toThrow();
  const getter = Object.defineProperty({}, 'entryResources', { enumerable: true, get: () => { throw new Error('must not execute accessor'); } });
  expect(() => parseQuestWorldDocument(getter)).toThrow('JSON rows');
});
