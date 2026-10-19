import { expect, test } from 'vitest';
import { createConchReadablePreviewOutput, createConchReadablePreviewSource, CONCH_READABLE_PREVIEW_DECISION_MEMORY } from '../src/shards/driftwood-isle/generators/conchReadablePreview';

test('isolated source keeps only Conch, both real strikes and one decision, with no world progress', () => {
  const source = createConchReadablePreviewSource();
  expect(source.runtime?.spawns?.actors?.map(row => row.kind)).toEqual(['conch-duelist']);
  expect(source.runtime?.spawns?.homes).toEqual([]); expect(source.runtime?.spawns?.bosses).toEqual([]);
  expect(source.state.shared.map(row => row.name)).toEqual(['conch-st', 'conch-guard', 'regular-clock']);
  expect(CONCH_READABLE_PREVIEW_DECISION_MEMORY).toBe(131072);
  const output = createConchReadablePreviewOutput({ diagnosticOnly: true });
  expect(output.namedFiles?.map(row => row.name)).toEqual(['poses/conch-duelist.json', 'practice/bodies.json', 'practice/looks.json', 'practice/pickups.json']);
  expect(output.platform?.sections.map(row => row.name).sort()).toEqual(['actors/moves', 'actors/species-programs', 'actors/strikes', 'held/arms', 'sim/scripts']);
  expect(source.quests).toEqual({ flags: [], quests: [], triggers: [], dialogue: [] });
  expect(source.encounters).toEqual([]); expect(source.ledger).toEqual([]);
});

test('all gameplay, lighting, body and pickup inputs are byte-equivalent to motion3', async () => {
  const { createConchPlantedPreviewOutput, createConchPlantedPreviewSource } = await import('../src/shards/driftwood-isle/generators/conchPlantedPreview');
  const baseline = createConchPlantedPreviewOutput({ diagnosticOnly: true });
  const candidate = createConchReadablePreviewOutput({ diagnosticOnly: true });
  expect(candidate.platform).toEqual(baseline.platform);
  expect(candidate.namedFiles?.filter(row => row.name !== 'poses/conch-duelist.json'))
    .toEqual(baseline.namedFiles?.filter(row => row.name !== 'poses/conch-duelist.json'));
  const old = createConchPlantedPreviewSource();
  const next = createConchReadablePreviewSource();
  expect({ ...next, identity: old.identity }).toEqual(old);
});

test('root and lower-body programs retain exact motion3 bytecode and strict node bounds', async () => {
  const { conchPlantedClips } = await import('../src/shards/driftwood-isle/generators/conchPlantedClips');
  const { conchReadableClips } = await import('../src/shards/driftwood-isle/generators/conchReadableClips');
  const old = conchPlantedClips(), next = conchReadableClips();
  const lower = (program: typeof old.programs[number]) => {
    const target = program.numeric?.outputs[0]?.target;
    return target === 'joint.body' || target?.startsWith('joint.leg') === true;
  };
  const bytecode = (program: typeof old.programs[number]) => ({ ...program, id: 'identity-ignored' });
  expect(next.programs.filter(lower).map(bytecode)).toEqual(old.programs.filter(lower).map(bytecode));
  expect(next.scalars).toEqual(old.scalars);
  for (const program of next.programs) expect(program.nodes.length).toBeLessThanOrEqual(128);
});
