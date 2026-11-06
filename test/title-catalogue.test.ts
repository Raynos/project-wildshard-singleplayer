import { expect, test } from 'vitest';
import { contentHash } from '../src/game/shared/shardfile/contentHash';
import { GridCellEvents } from '../src/game/shared/grid/cellEvents';
import { titleRowOf } from '../scripts/app-build/catalogue';
import { titlePrefetchOrder } from '../src/game/client/grid/titleOrder';
import { GridAssembly } from '../src/game/shared/grid/assembly';
import { gridPrefetchOrder } from '../src/game/client/grid/prefetch';
import { titleMetadata, type TitleManifest } from '../src/game/client/shard/titleList';

test('a title row is a discovery document\'s data, with its cards where a home serves them', () => {
  const data: TitleManifest = { slug: 'island', name: 'A title', biome: 'A biome', status: 'hidden',
    card: { thumb: '/shardfiles/island/blobs/image/a.jpg', portrait: '/shardfiles/island/blobs/image/a.jpg', landscape: 'data:image/png;base64,' },
    shardfile: '/shardfiles/island/shard.json' };
  const bytes = new TextEncoder().encode(JSON.stringify({ version: 1, slug: 'island', data: { ...data, load: 'no code travels', blurb: 'no prose either' }, rows: {}, native: {} }));
  const row = titleRowOf(bytes);
  expect(row).toEqual({ ...data, discovery: expect.stringMatching(/^\/shardfiles\/island\/discovery\.json\?v=[a-f0-9]{8}$/u) });
  const homed = titleRowOf(bytes, 'https://packs.example');
  expect(homed.card).toEqual({ thumb: `https://packs.example${data.card.thumb}`, portrait: `https://packs.example${data.card.thumb}`, landscape: data.card.landscape });
  expect(homed.discovery?.startsWith('https://packs.example/shardfiles/island/discovery.json')).toBe(true);
  const executable = { ...data, load: () => { throw new Error('Never load a world on the title'); } };
  expect(titleMetadata(executable)).toEqual(data);
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
