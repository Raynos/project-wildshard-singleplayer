import { expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile, shardfileRules } from '../src/game/shardfile/schema';
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
  for (const binds of [[], ['quests'], ['ledger', 'items'], ['quests', 'ledger', 'items'], ['state']]) {
    expect(parseShardfile({ ...source, runtime: { entry, binds } }).runtime?.binds).toEqual(binds);
  }
  for (const binds of [['quests', 'quests'], ['world'], ['quests', 'ledger', 'items', 'spawns', 'quests'], null, 'quests']) {
    expect(() => parseShardfile({ ...source, runtime: { entry, binds } })).toThrow();
  }
  expect(() => parseShardfile({ ...source, binds: ['quests'] })).toThrow();
  expect(() => parseShardfile({ ...source, runtime: { entry, binds: ['quests'], install: 'quests' } })).toThrow();
});

it('admits runtime-bound state through the ordinary state schema with its bounded scalar defaults', () => {
  const source = empty(), state = { ...source.state, shared: [
    { id: 1, name: 'runtime.ready', type: 'bool', privacy: 'host', default: false },
    { id: 2, name: 'ammo.rounds', type: 'i32', privacy: 'host', default: 4, min: 0, max: 100 },
    { id: 3, name: 'runtime.progress', type: 'f64', privacy: 'host', default: 0.5, min: 0, max: 1 },
    { id: 4, name: 'lodge.board', type: 'string', privacy: 'host', default: '{}' },
  ] };
  const runtime = { entry: 'runtime/index.ts', binds: ['state'] };
  const admit = (input: unknown) => parseShardfile({ ...source, runtime, state: input });
  expect(admit(state).state).toEqual(state);
  expect(admit(source.state).runtime?.binds).toEqual(['state']);
  const text = { id: 4, name: 'lodge.board', type: 'string', privacy: 'host', default: 'x'.repeat(4096) };
  expect(admit({ ...state, shared: [text] }).state.shared[0]?.default).toBe(text.default);
  for (const field of [{ ...text, default: 'x'.repeat(4097) }, { ...text, default: () => '{}' },
    { ...text, min: 0 }, { ...text, id: 0 }, { ...text, id: 0x80000000 },
    { ...text, type: 'i32', default: 1.5 }, { ...text, type: 'bool', default: 1 },
    { ...text, type: 'f64', default: Infinity }, { ...text, type: 'f64', default: 2, min: 0, max: 1 }]) {
    expect(() => admit({ ...state, shared: [field] })).toThrow();
  }
  expect(() => admit({ ...state, shared: [text, text] })).toThrow();
  expect(() => parseShardfile({ ...source, runtime: { ...runtime, state } })).toThrow();
});

it('refuses simulation-owned fields at full admission only when runtime binds state', () => {
  const source = empty(), field = { id: 1, name: 'runtime.memo', type: 'string', privacy: 'host', default: '{}' };
  const runtime = { entry: 'runtime/index.ts', binds: ['state'] };
  for (const state of [{ ...source.state, shared: [{ ...field, privacy: 'public' }] },
    { ...source.state, shared: [{ ...field, privacy: 'owner' }] }, { ...source.state, player: [field] }]) {
    const unbound = parseShardfile({ ...source, state });
    expect(unbound.state).toEqual(state);
    expect(shardfileRules({ ...unbound, runtime: { entry: runtime.entry, binds: ['state'] } })).toContain('runtime-bound state supports only host-owned shared fields');
    expect(() => parseShardfile({ ...source, runtime, state })).toThrow('shardfile semantic rules');
  }
});

it('admits runtime spawn rows exactly when the full schema declares their binding', () => {
  const source = empty(), entry = 'runtime/index.ts', spawns = { homes: [], bosses: [] };
  for (const binds of [['spawns'], ['quests', 'ledger', 'items', 'spawns'], ['quests', 'ledger', 'items', 'spawns', 'state']]) {
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
  const nativeBoss = { ...boss, kind: 'antler-king' };
  expect(admit({ homes: [home], bosses: [nativeBoss] }).runtime?.spawns?.bosses[0]?.kind).toBe('antler-king');
  expect(admit({ homes: [{ ...home, kind: 'k'.repeat(64) }], bosses: [] }).runtime?.spawns?.homes[0]?.kind).toBe('k'.repeat(64));
  for (const kind of ['-antler', 'Antler-king', 'antler king', 'antler_king', 'k'.repeat(65)]) {
    expect(() => admit({ homes: [], bosses: [{ ...boss, kind }] })).toThrow();
  }

  for (const bad of [{ homes: [home, home], bosses: [] }, { homes: [home], bosses: [{ ...boss, id: home.id }] },
    { homes: [], bosses: [boss, boss] }, { homes: [], bosses: [], extra: true }, { homes: [] }, { bosses: [] }]) {
    expect(() => admit(bad)).toThrow();
  }
  for (const badHome of [{ ...home, respawn: 0 }, { ...home, respawn: 3601 }, { ...home, at: [250.01, 0] },
    { ...home, yaw: Infinity }, { ...home, kind: 'bad_kind' }, { ...home, look: 'BadLook' },
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

it('admits optional finite one-shot actors without changing row order or omitted-field output', () => {
  const source = empty(), spawns = { homes: [], bosses: [] };
  const runtime = { entry: 'runtime/index.ts', binds: ['spawns'] };
  const admit = (input: unknown) => parseShardfile({ ...source, runtime: { ...runtime, spawns: input } });
  const actor = { id: 'actor:z', kind: 'skySentinel', look: 'sentinel', at: [-250, 250], yaw: Math.PI };
  const actors = [actor, { ...actor, id: 'actor:a', kind: 'antler-king', at: [250, -250], yaw: 0 }];
  expect(admit(spawns).runtime?.spawns).toEqual(spawns);
  expect(admit(spawns).runtime?.spawns).not.toHaveProperty('actors');
  expect(admit({ ...spawns, actors: [] }).runtime?.spawns?.actors).toEqual([]);
  expect(admit({ ...spawns, actors }).runtime?.spawns?.actors).toEqual(actors);
  expect(admit({ ...spawns, actors }).runtime?.spawns?.actors?.map((row) => row.id)).toEqual(['actor:z', 'actor:a']);
  const maximum = Array.from({ length: 256 }, (_, index) => ({ ...actor, id: `actor:${index}` }));
  expect(admit({ ...spawns, actors: maximum }).runtime?.spawns?.actors).toEqual(maximum);
  for (const bad of [null, {}, [actor, actor], [...maximum, { ...actor, id: 'actor:256' }]]) {
    expect(() => admit({ ...spawns, actors: bad })).toThrow();
  }
  for (const bad of [{ ...actor, respawn: 60 }, { ...actor, at: [250.01, 0] }, { ...actor, at: [0, -250.01] },
    { ...actor, yaw: Infinity }, { ...actor, id: 'a'.repeat(129) }, { ...actor, kind: 'k'.repeat(65) },
    { ...actor, kind: 'bad_kind' }, { ...actor, look: 'BadLook' }, { ...actor, look: 'l'.repeat(129) },
    { ...actor, spawn: () => undefined }]) {
    expect(() => admit({ ...spawns, actors: [bad] })).toThrow();
  }
  expect(() => admit({ homes: [{ ...actor, respawn: 60 }], bosses: [], actors: [actor] })).toThrow('unique runtime spawn identities');
  expect(() => admit({ homes: [], bosses: [actor], actors: [actor] })).toThrow('unique runtime spawn identities');
  expect(() => parseShardfile({ ...source, runtime: { entry: runtime.entry, spawns: { ...spawns, actors } } })).toThrow('runtime spawns');
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
  const source = empty(); source.runtime = { entry: 'runtime/index.ts', binds: ['quests', 'ledger', 'items', 'spawns', 'state'], spawns: { homes: [], bosses: [], actors: [{ id: 'actor:1', kind: 'skySentinel', look: 'sentinel', at: [0, 0], yaw: 0 }] } };
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
  const source = empty(); source.runtime = { entry: 'runtime/index.ts', binds: ['state'] };
  source.state.shared.push({ id: 1, name: 'runtime.memo', type: 'string', privacy: 'host', default: '{}' });
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
