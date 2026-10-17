import { expect, test, vi } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import * as runtimeProduct from '../src/game/shardfile/runtimeProduct';
import { NPC_FIGURE } from '../src/shards/pine-hollow/generators/peopleLook';
import { output } from '../src/shards/pine-hollow/generators/output';
import { loadNpcFigureRows, npcFigureRows } from '../src/shards/pine-hollow/runtime/npc/standInPerson';
import { rangerHale, millerBrandt, traderMott } from '../src/shards/pine-hollow/runtime/models/people';
import * as codeParts from '../src/shards/pine-hollow/runtime/world/codeParts';

const shardfile = emptyShardfile({ slug: 'pine-figure-test', name: 'Figure', author: 'Wildshard', revision: 1, seed: 1 });
function product(value: unknown) {
  const view = output.namedFiles.find(row => row.name === 'look/native-view.json');
  const viewBytes = view === undefined ? undefined : output.assets.get(view.hash);
  if (view === undefined || viewBytes === undefined) throw new Error('Missing named NPC view');
  return createShardProduct({ slug: shardfile.identity.slug, revision: 1, shardfile, sections: new Map(),
    files: new Map([['people/figure.json', { hash: 'figure', url: 'figure.json' }], ['look/native-view.json', { hash:view.hash, url:view.path }]]),
    read: hash => Promise.resolve(hash === view.hash ? viewBytes : new TextEncoder().encode(JSON.stringify(value))) });
}

test('NPC figure admission keeps every authored number, refuses malformed rows atomically and prepares cold cards', async () => {
  expect(npcFigureRows).toThrow('not admitted');
  const file = output.namedFiles.find(row => row.name === 'people/figure.json');
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (bytes === undefined) throw new Error('Missing named NPC figure');
  const admitted = product(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  await loadNpcFigureRows(admitted);
  const previous = npcFigureRows();
  expect(previous).toEqual(NPC_FIGURE);
  await expect(loadNpcFigureRows(product({ ...NPC_FIGURE, extra: true }))).rejects.toThrow();
  await expect(loadNpcFigureRows(product({ ...NPC_FIGURE, flame: { ...NPC_FIGURE.flame, color: [1, 2] } }))).rejects.toThrow();
  await expect(loadNpcFigureRows(product({ ...NPC_FIGURE, walk: { speed: 'bad', cycle: 1 } }))).rejects.toThrow();
  expect(npcFigureRows()).toBe(previous);
  const fetch = vi.spyOn(runtimeProduct, 'loadFirstPartyProduct').mockResolvedValue(admitted);
  const parts = vi.spyOn(codeParts, 'loadCodeParts').mockResolvedValue();
  try {
    const models = [rangerHale, millerBrandt, traderMott];
    for (const model of models) {
      if (model.prepare === undefined) throw new Error('Cold NPC card has no prepare');
      await model.prepare();
      expect(npcFigureRows()).toEqual(NPC_FIGURE);
    }
    expect(models.map(row => row.id)).toEqual(['pine-hollow/ranger-hale', 'pine-hollow/miller-brandt', 'pine-hollow/trader-mott']);
    expect(models.map(row => row.name)).toEqual(['Hale, ranger of the Hollow', 'Brandt, the miller', 'Mott, the trader']);
    expect(parts).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenCalledTimes(3);
  } finally { fetch.mockRestore(); parts.mockRestore(); }
});
