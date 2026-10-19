import { expect, test } from 'vitest';
import { createConchMotion5PreviewOutput, createConchMotion5PreviewSource, CONCH_MOTION5_PREVIEW_DECISION_MEMORY } from '../art/driftwood-isle/approved-conch/motion5-study/conchMotion5Preview';

test('isolated source keeps only Conch, both real strikes and one decision, with no world progress', () => {
  const source = createConchMotion5PreviewSource();
  expect(source.runtime?.spawns?.actors?.map(row => row.kind)).toEqual(['conch-duelist']);
  expect(source.runtime?.spawns?.homes).toEqual([]); expect(source.runtime?.spawns?.bosses).toEqual([]);
  expect(source.state.shared.map(row => row.name)).toEqual(['conch-st', 'conch-guard', 'regular-clock']);
  expect(CONCH_MOTION5_PREVIEW_DECISION_MEMORY).toBe(131072);
  const output = createConchMotion5PreviewOutput({ diagnosticOnly: true });
  expect(output.namedFiles?.map(row => row.name)).toEqual(['poses/conch-duelist.json', 'practice/bodies.json', 'practice/looks.json', 'practice/pickups.json']);
  expect(output.platform?.sections.map(row => row.name).sort()).toEqual(['actors/moves', 'actors/species-programs', 'actors/strikes', 'held/arms', 'sim/scripts']);
  expect(source.quests).toEqual({ flags: [], quests: [], triggers: [], dialogue: [] });
  expect(source.encounters).toEqual([]); expect(source.ledger).toEqual([]);
});

test('all gameplay, lighting, body and pickup inputs are byte-equivalent to motion3', async () => {
  const { createConchPlantedPreviewOutput, createConchPlantedPreviewSource } = await import('../src/shards/driftwood-isle/generators/conchPlantedPreview');
  const baseline = createConchPlantedPreviewOutput({ diagnosticOnly: true });
  const candidate = createConchMotion5PreviewOutput({ diagnosticOnly: true });
  expect(candidate.platform).toEqual(baseline.platform);
  expect(candidate.namedFiles?.filter(row => row.name !== 'poses/conch-duelist.json'))
    .toEqual(baseline.namedFiles?.filter(row => row.name !== 'poses/conch-duelist.json'));
  const old = createConchPlantedPreviewSource();
  const next = createConchMotion5PreviewSource();
  expect({ ...next, identity: old.identity }).toEqual(old);
});
