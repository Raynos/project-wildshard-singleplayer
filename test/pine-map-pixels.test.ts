import { expect, it } from 'vitest';
import type { ProjectGenerationContext, ProjectGenerationStep } from '@wildshard/sdk/projectGeneration';
import { cachedMapPixels } from '../src/shards/pine-hollow/generators/mapPixelsCache';
import { sourcesOf, frozenSourcesOf, isFrozenSources } from '../src/shards/pine-hollow/generators/pineSources';

function cache(): { ctx: Pick<ProjectGenerationContext, 'cached'>; ids: string[] } {
  const saved = new Map<string, ReadonlyMap<string, Uint8Array>>(), ids: string[] = [];
  return { ids, ctx: { cached: async (step: ProjectGenerationStep, generate) => {
    expect(step.native).toBe(true);
    ids.push(step.id);
    let files = saved.get(step.id);
    if (files === undefined) { files = await generate(new Map()); saved.set(step.id, files); }
    return new Map([...files].map(([name, bytes]) => [name, bytes.slice()]));
  } } };
}
const pixels = (value: number): Uint8Array => new Uint8Array(4_000_000).fill(value);

it('preserves bake identity only for genuine owned immutable program snapshots', async () => {
  const files = new Map([['a', new Uint8Array([7])]]), snapshot = frozenSourcesOf(files);
  expect(Object.isFrozen(snapshot)).toBe(true); expect(isFrozenSources(snapshot)).toBe(true);
  expect(isFrozenSources(Object.freeze(sourcesOf(files)))).toBe(false);
  files.get('a')?.fill(8); snapshot.bytes('a').fill(9);
  expect(snapshot.bytes('a')).toEqual(new Uint8Array([7]));
  const { ctx } = cache();
  await cachedMapPixels(ctx, snapshot, input => {
    expect(input).toBe(snapshot);
    return Promise.resolve(pixels(input.bytes('a')[0] ?? 0));
  });
});

it('reuses exact pixels after reading every source, with detached cache results', async () => {
  const { ctx, ids } = cache(), files = new Map([['a', new Uint8Array([7])], ['b', new Uint8Array([3])]]);
  const sources = sourcesOf(files); let paints = 0;
  const paint = (): Promise<Uint8Array> => { paints++; return Promise.resolve(pixels(7)); };
  const first = await cachedMapPixels(ctx, sources, paint); first[0] = 99;
  expect((await cachedMapPixels(ctx, sourcesOf(new Map([...files].reverse())), paint)).every(byte => byte === 7)).toBe(true);
  expect(paints).toBe(1); expect(ids[0]).toBe(ids[1]);
  expect(ids[0]).toMatch(/^pine-map-[a-f0-9]{64}$/u);
  files.get('a')?.fill(9);
  await cachedMapPixels(ctx, sources, paint);
  files.set('c', new Uint8Array([3])); await cachedMapPixels(ctx, sources, paint);
  files.delete('b'); await cachedMapPixels(ctx, sources, paint);
  expect(paints).toBe(4); expect(new Set(ids).size).toBe(4);
});

it('binds painted reads to the exact key bodies and refuses changed or absent inputs', async () => {
  const { ctx } = cache(), body = new Uint8Array([5]), files = new Map([['a', body]]), sources = sourcesOf(files);
  await expect(cachedMapPixels(ctx, sources, checked => {
    expect(checked.list('a')).toEqual(['a']); expect(checked.has('a')).toBe(true);
    const copy = checked.bytes('a'); copy[0] = 10;
    expect(checked.bytes('a')).toEqual(new Uint8Array([5]));
    expect(() => checked.bytes('missing')).toThrow('Undeclared Pine source');
    body[0] = 8;
    checked.bytes('a'); return Promise.resolve(pixels(8));
  })).rejects.toThrow('Pine map source changed');
  const actual = await cachedMapPixels(ctx, sources, checked => Promise.resolve(pixels(checked.bytes('a')[0] ?? 0)));
  expect(actual.every(byte => byte === 8)).toBe(true);
});

it('retains paint failures and refuses incomplete cache or painter payloads', async () => {
  const sources = sourcesOf(new Map());
  await expect(cachedMapPixels(cache().ctx, sources, () => Promise.reject(new Error('bad geometry')))).rejects.toThrow('bad geometry');
  await expect(cachedMapPixels(cache().ctx, sources, () => Promise.resolve(new Uint8Array(3)))).rejects.toThrow('lattice size');
  for (const files of [new Map<string, Uint8Array>(), new Map([['map.rgba', pixels(2)], ['extra', new Uint8Array()]])]) {
    const ctx: Pick<ProjectGenerationContext, 'cached'> = { cached: () => Promise.resolve(files) };
    await expect(cachedMapPixels(ctx, sources, () => Promise.resolve(pixels(2)))).rejects.toThrow('lattice size');
  }
});
