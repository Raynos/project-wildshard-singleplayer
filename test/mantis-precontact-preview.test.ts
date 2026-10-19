import { expect, test } from 'vitest';
import { createMantisPrecontactPreviewOutput, createMantisPrecontactPreviewSource, MANTIS_PRECONTACT_PREVIEW_DECISION_MEMORY } from '../src/shards/driftwood-isle/generators/mantisPrecontactPreview';

test('isolated source keeps only Mantis, both real strikes and one decision, with no world progress', () => {
  const source = createMantisPrecontactPreviewSource();
  expect(source.runtime?.spawns?.actors?.map(row => row.kind)).toEqual(['splinter-mantis']);
  expect(source.runtime?.spawns?.homes).toEqual([]); expect(source.runtime?.spawns?.bosses).toEqual([]);
  expect(source.state.shared.map(row => row.name)).toEqual(['mantis-st', 'mantis-beat', 'regular-clock', 'mantis-pose-phase', 'mantis-pose-clock']);
  expect(MANTIS_PRECONTACT_PREVIEW_DECISION_MEMORY).toBe(131072);
  const output = createMantisPrecontactPreviewOutput({ diagnosticOnly: true });
  expect(output.namedFiles?.map(row => row.name)).toEqual(['poses/splinter-mantis.json', 'practice/bodies.json', 'practice/looks.json', 'practice/pickups.json']);
  expect(output.platform?.sections.map(row => row.name).sort()).toEqual(['actors/moves', 'actors/species-programs', 'actors/strikes', 'held/arms', 'sim/scripts']);
  expect(source.quests).toEqual({ flags: [], quests: [], triggers: [], dialogue: [] });
  expect(source.encounters).toEqual([]); expect(source.ledger).toEqual([]);
});
test('combat, rewards, AI and all non-pose catalogues preserve candidate6 exact source', async () => {
  const { createMantisEarlyKneePreviewSource, createMantisEarlyKneePreviewOutput } = await import('../src/shards/driftwood-isle/generators/mantisEarlyKneePreview');
  const before = createMantisEarlyKneePreviewSource(), after = createMantisPrecontactPreviewSource();
  // Only the isolated developer display name changes in the source document.
  expect(JSON.stringify(after).replaceAll('Precontact', 'EarlyKnee')).toBe(JSON.stringify(before));
  const a = createMantisEarlyKneePreviewOutput({ diagnosticOnly: true }), b = createMantisPrecontactPreviewOutput({ diagnosticOnly: true });
  expect(b.platform?.sections.filter(row => row.name !== 'actors/species-programs')).toEqual(a.platform?.sections.filter(row => row.name !== 'actors/species-programs'));
  for (const [path, bytes] of a.platform?.files ?? []) {
    const candidate = b.platform?.files.get(path); if (!candidate) throw new Error('Missing platform bytes');
    expect(new TextDecoder().decode(candidate).replaceAll('Precontact', 'EarlyKnee')).toBe(new TextDecoder().decode(bytes));
  }
  for (const row of a.namedFiles ?? []) if (row.name !== 'poses/splinter-mantis.json') expect(b.namedFiles?.find(candidate => candidate.name === row.name)).toEqual(row);
});
