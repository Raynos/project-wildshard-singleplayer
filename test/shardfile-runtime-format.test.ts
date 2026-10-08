import { expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '../src/game/shardfile/schema';
import { admitProduct, type ProductOptions } from '../src/game/shardfile/product';
import { emptyShardfileSource, installShardfileProduct, shardfileSource } from '../src/game/shardfile/loader';
import type { ShardfileClientBindings } from '../src/game/shardfile/client';
import { App } from '../src/engine/app/app';
import { createLevelInstallation } from '../src/engine/level/installation';
import { shardContext } from '../src/game/shard/context';

const empty = () => emptyShardfile({ slug: 'runtime-format', name: 'Runtime fixture', author: 'Fixture', revision: 1, seed: 1 });
const options: ProductOptions = { base: 'https://fixture.test/runtime/', firstParty: true, offline: false,
  fetch: () => Promise.reject(new Error('No content request expected')), hash: () => Promise.reject(new Error('No asset hashing expected')) };
const bindings: ShardfileClientBindings = { instance: 'fixture', catalogue: [], items: new Map(), recipes: new Map(), icon: () => 'glyph', voices: () => new Map() };

it('defaults runtime to null and admits only a bounded relative TypeScript entry', () => {
  expect(empty().runtime).toBeNull();
  const source = empty(); source.runtime = { entry: 'runtime/doors/index.ts' };
  expect(parseShardfile(source).runtime).toEqual(source.runtime);
  for (const entry of ['https://fixture.test/code.ts', '/runtime/index.ts', 'runtime/../index.ts', 'runtime/index.js', 'runtime/index.ts?variant=1']) {
    expect(() => parseShardfile({ ...source, runtime: { entry } })).toThrow();
  }
  expect(() => parseShardfile({ ...source, runtime: { entry: 'runtime/index.ts', url: 'https://fixture.test/code.ts' } })).toThrow();
});

it('refuses external runtime declarations before fetching or publishing, including cached declarations', async () => {
  const source = empty(); source.runtime = { entry: 'runtime/index.ts' };
  let published = false;
  const cache = { product: () => Promise.resolve({ source, firstParty: true }), asset: () => Promise.resolve(null),
    putAsset: () => Promise.resolve(), putProduct: () => { published = true; return Promise.resolve(); } };
  for (const offline of [false, true]) {
    await expect(admitProduct(source, { ...options, cache, firstParty: false, offline })).rejects.toThrow('trusted first-party');
  }
  expect(published).toBe(false);
});

it('requires explicit hybrid composition while exposing the admitted first-party data plugin to that compositor', async () => {
  const source = empty(); source.runtime = { entry: 'runtime/index.ts' };
  expect(() => emptyShardfileSource(source)).toThrow('trusted hybrid composition');
  await expect(installShardfileProduct(source, options, bindings)).rejects.toThrow('trusted hybrid composition');
  const data = await shardfileSource(source, options, bindings);
  expect(data.loadout).toEqual({ weapons: [], tools: ['tool.hoverboard'], start: ['tool.hoverboard'] });
  expect(typeof (await data.load?.())?.default).toBe('function');
});

it('makes only explicitly trusted empty hybrid data stages no-ops, preserving the exact legacy service census', async () => {
  const source = empty(); source.runtime = { entry: 'runtime/index.ts' };
  const data = await shardfileSource(source, options, { ...bindings, trustedRuntime: true }), loaded = await data.load?.();
  if (loaded === undefined) throw new Error('Missing admitted data plugin');
  const app = new App(), scope = app.engineScope.child('empty-hybrid'), installation = createLevelInstallation(app, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const ctx = shardContext(installation.context, data, { shard: data, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } });
  const census = () => ({ scope: scope.census, systems: app.systemIds(scope), input: app.input.contexts, root: ctx.root.children.length, game: [...ctx.game.rows] });
  try {
    const { default: Data } = loaded, before = census(), plugin = new Data();
    await plugin.world?.(ctx); await plugin.kit?.(ctx); await plugin.play?.(ctx); expect(census()).toEqual(before);
    const ordinary = await shardfileSource(empty(), options, bindings), plain = await ordinary.load?.();
    if (plain === undefined) throw new Error('Missing normal empty product');
    const { default: Plain } = plain;
    await expect(new Plain().world?.(ctx)).rejects.toThrow('normal world stage');
    source.ui.push({ kind: 'marker', id: 'marker', label: 'Marker', at: [0, 0, 0] });
    const authored = await shardfileSource(source, options, { ...bindings, trustedRuntime: true }), active = await authored.load?.();
    if (active === undefined) throw new Error('Missing authored hybrid data');
    const { default: Active } = active;
    await expect(new Active().world?.(ctx)).rejects.toThrow('normal world stage');
    await expect(shardfileSource(empty(), options, { ...bindings, trustedRuntime: true })).rejects.toThrow('runtime declaration');
  } finally { scope.dispose(); }
});
