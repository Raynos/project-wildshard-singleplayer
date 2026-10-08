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

it('admits only the unique bounded runtime-owned section names through the full shardfile schema', () => {
  const source = empty(), entry = 'runtime/index.ts';
  expect(parseShardfile({ ...source, runtime: { entry } }).runtime?.binds).toBeUndefined();
  for (const binds of [[], ['quests'], ['ledger', 'items'], ['quests', 'ledger', 'items']]) {
    expect(parseShardfile({ ...source, runtime: { entry, binds } }).runtime?.binds).toEqual(binds);
  }
  for (const binds of [['quests', 'quests'], ['world'], ['quests', 'ledger', 'items', 'spawns', 'quests'], null, 'quests']) {
    expect(() => parseShardfile({ ...source, runtime: { entry, binds } })).toThrow();
  }
  expect(() => parseShardfile({ ...source, binds: ['quests'] })).toThrow();
  expect(() => parseShardfile({ ...source, runtime: { entry, binds: ['quests'], install: 'quests' } })).toThrow();
});

it('admits runtime spawn rows exactly when the full schema declares their binding', () => {
  const source = empty(), entry = 'runtime/index.ts', spawns = { homes: [], bosses: [] };
  for (const binds of [['spawns'], ['quests', 'ledger', 'items', 'spawns']]) {
    const runtime = { entry, binds, spawns };
    expect(parseShardfile({ ...source, runtime }).runtime).toEqual(runtime);
    expect(() => parseShardfile({ ...source, runtime: { entry, binds } })).toThrow('runtime spawns');
  }
  for (const binds of [undefined, [], ['quests', 'ledger', 'items']]) {
    expect(() => parseShardfile({ ...source, runtime: { entry, ...(binds === undefined ? {} : { binds }), spawns } })).toThrow('runtime spawns');
  }
  expect(() => parseShardfile({ ...source, runtime: { entry, binds: ['spawns'], spawns: null } })).toThrow();
  expect(() => parseShardfile({ ...source, spawns })).toThrow();
});

it('validates runtime home and boss data, bounds and shared identities through the full schema', () => {
  const source = empty(), home = { id: 'home:1', kind: 'sandBull', look: 'sand-bull', at: [-250, 250], yaw: 0, respawn: 3600 };
  const boss = { id: 'boss:1', kind: 'matriarch', look: 'matriarch', at: [250, -250], yaw: Math.PI };
  const admit = (spawns: unknown) => parseShardfile({ ...source, runtime: { entry: 'runtime/index.ts', binds: ['spawns'], spawns } });
  const spawns = { homes: [home], bosses: [boss] };
  expect(admit(spawns).runtime?.spawns).toEqual(spawns);
  for (const bad of [{ homes: [home, home], bosses: [] }, { homes: [home], bosses: [{ ...boss, id: home.id }] },
    { homes: [], bosses: [boss, boss] }, { homes: [], bosses: [], extra: true }, { homes: [] }, { bosses: [] }]) {
    expect(() => admit(bad)).toThrow();
  }
  for (const badHome of [{ ...home, respawn: 0 }, { ...home, respawn: 3601 }, { ...home, at: [250.01, 0] },
    { ...home, yaw: Infinity }, { ...home, kind: 'bad-kind' }, { ...home, look: 'BadLook' },
    { ...home, id: 'h'.repeat(129) }, { ...home, kind: 'k'.repeat(65) }, { ...home, brain: 'pursue' }]) {
    expect(() => admit({ ...spawns, homes: [badHome] })).toThrow();
  }
  expect(() => admit({ homes: [], bosses: [{ ...boss, respawn: 60 }] })).toThrow();
  expect(() => admit({ homes: [], bosses: [{ ...boss, at: [0, -250.01] }] })).toThrow();
  const homes = Array.from({ length: 256 }, (_, i) => ({ ...home, id: `home:${i}` }));
  const bosses = Array.from({ length: 16 }, (_, i) => ({ ...boss, id: `boss:${i}` }));
  expect(admit({ homes, bosses }).runtime?.spawns).toEqual({ homes, bosses });
  expect(() => admit({ homes: [...homes, { ...home, id: 'home:256' }], bosses })).toThrow();
  expect(() => admit({ homes, bosses: [...bosses, { ...boss, id: 'boss:16' }] })).toThrow();
});

it('keeps runtime-bound quest rows under ordinary format validation before any binding', () => {
  const source = empty(), quest = { id: 'runtime.quest', title: 'Bound quest', completeFlag: 'done',
    steps: [{ id: 'first', objective: 'Finish the task', chip: 'Finish task', done: { all: ['done'] } }] };
  const declaration = { ...source, runtime: { entry: 'runtime/index.ts', binds: ['quests'] },
    quests: { flags: ['done'], quests: [quest], triggers: [], dialogue: [] } };
  expect(parseShardfile(declaration).quests.quests[0]).toEqual(quest);
  expect(() => parseShardfile({ ...declaration, quests: { ...declaration.quests, flags: [] } })).toThrow();
  expect(() => parseShardfile({ ...declaration, quests: { ...declaration.quests, quests: [{ ...quest,
    steps: [{ ...quest.steps[0], chip: 'This chip exceeds eighteen characters' }] }] } })).toThrow();
});

it('refuses external runtime declarations before fetching or publishing, including cached declarations', async () => {
  const source = empty(); source.runtime = { entry: 'runtime/index.ts', binds: ['quests', 'ledger', 'items', 'spawns'], spawns: { homes: [], bosses: [] } };
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
