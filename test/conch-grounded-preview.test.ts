import { expect, test } from 'vitest';
import { createConchGroundedPreviewOutput, createConchGroundedPreviewSource, CONCH_GROUNDED_PREVIEW_DECISION_MEMORY } from '../src/shards/driftwood-isle/generators/conchGroundedPreview';

test('isolated source keeps only Conch, both real strikes and one decision, with no world progress', () => {
  const source = createConchGroundedPreviewSource();
  expect(source.runtime?.spawns?.actors?.map(row => row.kind)).toEqual(['conch-duelist']);
  expect(source.runtime?.spawns?.homes).toEqual([]); expect(source.runtime?.spawns?.bosses).toEqual([]);
  expect(source.state.shared.map(row => row.name)).toEqual(['conch-st', 'conch-guard', 'regular-clock']);
  expect(CONCH_GROUNDED_PREVIEW_DECISION_MEMORY).toBe(131072);
  const output = createConchGroundedPreviewOutput({ diagnosticOnly: true });
  expect(output.namedFiles?.map(row => row.name)).toEqual(['poses/conch-duelist.json', 'practice/bodies.json', 'practice/looks.json', 'practice/pickups.json']);
  expect(output.platform?.sections.map(row => row.name).sort()).toEqual(['actors/moves', 'actors/species-programs', 'actors/strikes', 'held/arms', 'sim/scripts']);
  expect(source.quests).toEqual({ flags: [], quests: [], triggers: [], dialogue: [] });
  expect(source.encounters).toEqual([]); expect(source.ledger).toEqual([]);
});
