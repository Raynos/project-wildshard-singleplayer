import { expect, test } from 'vitest';
import { createMantisEarlyKneePreviewOutput, createMantisEarlyKneePreviewSource, MANTIS_EARLY_KNEE_PREVIEW_DECISION_MEMORY } from '../src/shards/driftwood-isle/generators/mantisEarlyKneePreview';

test('isolated source keeps only Mantis, both real strikes and one decision, with no world progress', () => {
  const source = createMantisEarlyKneePreviewSource();
  expect(source.runtime?.spawns?.actors?.map(row => row.kind)).toEqual(['splinter-mantis']);
  expect(source.runtime?.spawns?.homes).toEqual([]); expect(source.runtime?.spawns?.bosses).toEqual([]);
  expect(source.state.shared.map(row => row.name)).toEqual(['mantis-st', 'mantis-beat', 'regular-clock', 'mantis-pose-phase', 'mantis-pose-clock']);
  expect(MANTIS_EARLY_KNEE_PREVIEW_DECISION_MEMORY).toBe(131072);
  const output = createMantisEarlyKneePreviewOutput({ diagnosticOnly: true });
  expect(output.namedFiles?.map(row => row.name)).toEqual(['poses/splinter-mantis.json', 'practice/bodies.json', 'practice/looks.json', 'practice/pickups.json']);
  expect(output.platform?.sections.map(row => row.name).sort()).toEqual(['actors/moves', 'actors/species-programs', 'actors/strikes', 'held/arms', 'sim/scripts']);
  expect(source.quests).toEqual({ flags: [], quests: [], triggers: [], dialogue: [] });
  expect(source.encounters).toEqual([]); expect(source.ledger).toEqual([]);
});