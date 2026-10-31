import { expect, expectTypeOf, test } from 'vitest';
import { clientChannelLimits } from '../src/sdk/clientChannels';
import { CLIENT_CHANNEL_LIMITS, type ClientChannelProgram as NativeChannel } from '../src/format/clientChannels';
import type { ClientChannelProgram } from '../src/sdk/rows';
import type { parseNpcDialogueRow } from '../src/sdk/questGraph';
import type { NpcDialogueRow } from '../src/format/npcs';
import { channelQuestAuthorObservation, historicalDriftwoodCatalogue } from './fixtures/channel-quest-author-observation';
import { EXPLORER_CATALOGUE as driftwood } from '../src/shards/driftwood-isle/generators/explorerCatalogue';
import original from './fixtures/channel-quest-author-original.json' with { type: 'json' };

test('channel limits and public channel/dialogue types retain their exact native definitions', () => {
  expect(clientChannelLimits()).toBe(CLIENT_CHANNEL_LIMITS);
  expectTypeOf<ClientChannelProgram>().toEqualTypeOf<NativeChannel>();
  expectTypeOf<ReturnType<typeof parseNpcDialogueRow>>().toEqualTypeOf<NpcDialogueRow>();
});

test('every original focus, dialogue, interaction, catalogue and animation-program byte remains unchanged', () => {
  expect(channelQuestAuthorObservation()).toEqual(original);
});

test('the two classified current source labels retain their exact IDs and leave the authored rows untouched', () => {
  const before = structuredClone(driftwood);
  expect(driftwood.entries.filter(row => row.kind === 'species' && row.id?.startsWith('shared/'))
    .map(row => row.kind === 'species' ? { id: row.id, file: row.file } : null)).toEqual([
    { id: 'shared/boar', file: 'src/game/models/explorerCatalogue.ts' },
    { id: 'shared/bear', file: 'src/game/models/explorerCatalogue.ts' },
  ]);
  historicalDriftwoodCatalogue(driftwood);
  expect(driftwood).toEqual(before);
});

test('historical reconstruction refuses foreign, missing and duplicate current provenance', () => {
  const target = driftwood.entries.find(row => row.kind === 'species' && row.id === 'shared/boar');
  if (target === undefined) throw new Error('Missing authored boar');
  const foreign = { ...driftwood, entries: driftwood.entries.map(row => row.kind === 'species' && row.id === 'shared/boar'
    ? { ...row, file: 'foreign-host' } : row) };
  const missing = { ...driftwood, entries: driftwood.entries.map(row => {
    if (row.kind !== 'species' || row.id !== 'shared/boar') return row;
    const { file, ...withoutFile } = row;
    expect(file).toBe('src/game/models/explorerCatalogue.ts');
    return withoutFile;
  }) };
  const missingRow = { ...driftwood, entries: driftwood.entries.filter(row => row.kind !== 'species' || row.id !== 'shared/boar') };
  const duplicate = { ...driftwood, entries: [...driftwood.entries, target] };
  for (const rows of [foreign, missing, missingRow, duplicate])
    expect(() => historicalDriftwoodCatalogue(rows)).toThrow('catalogue provenance');
});

test('an unrelated catalogue body change still breaks the original complete byte oracle', () => {
  const changed = structuredClone(driftwood);
  const boar = changed.entries.find(row => row.kind === 'species' && row.id === 'shared/boar');
  if (boar === undefined || boar.kind !== 'species') throw new Error('Missing authored boar');
  boar.spawnOnly = false;
  const observed = channelQuestAuthorObservation(changed);
  expect(observed.find(row => row.name === 'driftwood')).not.toEqual(original.find(row => row.name === 'driftwood'));
  expect(observed.filter(row => row.name !== 'driftwood')).toEqual(original.filter(row => row.name !== 'driftwood'));
});
