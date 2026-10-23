import { expect, test } from 'vitest';
import { contentHash } from '../src/game/shardfile/contentStore';
import { GridCellEvents } from '../src/game/grid/cellEvents';
import { titleCatalogueSource } from '../scripts/title-catalogue.mjs';
import { titlePrefetchOrder } from '../src/game/grid/titleOrder';
import { GridAssembly } from '../src/game/grid/assembly';
import { gridPrefetchOrder } from '../src/game/grid/prefetch';
import { titleMetadata, type TitleManifest } from '../src/game/shard/titleList';

test('compile title metadata and deduplicated image URLs without shard imports', () => {
  const row: TitleManifest = { slug: '_template', name: 'A title', biome: 'A biome', status: 'hidden',
    card: { thumb: '/src/shards/_template/card.jpg', portrait: '/src/shards/_template/card.jpg', landscape: '/assets/card.webp' },
    entries: { legacy: true, shardfile: true }, shardfile: '/shardfiles/example/shard.json' };
  const source = titleCatalogueSource([row]);
  expect(source).toContain('import image0 from "/src/shards/_template/card.jpg";');
  expect(source.match(/import /gu)).toHaveLength(1);
  expect(source).toContain('card:{thumb:image0,portrait:image0,landscape:"/assets/card.webp"}');
  const { card: _card, ...metadata } = row;
  expect(source).toContain(JSON.stringify(metadata));
  expect(source).not.toContain('discovery');
  expect(source).not.toContain('runtime');
  const { entries, ...withoutEntries } = row;
  expect(titleMetadata(withoutEntries).entries).toEqual({ legacy: false, shardfile: true });
  const executable = { ...withoutEntries, load: () => { throw new Error('Never load a world on the title'); } };
  expect(titleMetadata(executable)).toEqual({ ...withoutEntries, entries: { legacy: true, shardfile: false } });
  expect(titleMetadata({ ...executable, entries })).toEqual(row);
});

test('title placement data preserves the complete existing prefetch order in every mode', () => {
  for (const developer of [false, true]) for (const devserver of [false, true]) for (const nineDragon of [false, true]) {
    const mode = { developer, devserver, nineDragon };
    expect(titlePrefetchOrder(mode)).toEqual(gridPrefetchOrder(new GridAssembly(mode), { x: 0, z: 0 }));
  }
});

test('shared prefetch and admission digest respects an owned slice exactly', async () => {
  const bytes = new Uint8Array([9, 1, 2, 3, 8]);
  const hash = '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81';
  expect(await contentHash(bytes.subarray(1, 4))).toBe(hash);
  expect(await contentHash(new Uint8Array([1, 2, 3]))).toBe(hash);
});

test('lightweight cell events retain late enter and ordered leave semantics', () => {
  const cells = new GridCellEvents(), events: string[] = [];
  const first = { instance: 'first', slug: 'example' }, second = { instance: 'second', slug: 'example' };
  cells.enter(first);
  const off = cells.onEnter(cell => { events.push(`enter:${cell.instance}`); });
  cells.onLeave(cell => { events.push(`leave:${cell.instance}`); });
  cells.enter(first); cells.enter(second); off(); cells.leave();
  expect(events).toEqual(['enter:first', 'leave:first', 'enter:second', 'leave:second']);
  expect(cells.cell).toBeNull();
});
