// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { Scene, Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { app } from '../src/engine/app/runtime';
import { App } from '../src/engine/app/app';
import { createLevelInstallation } from '../src/engine/level/installation';
import { WorldRegistry } from '../src/engine/world/registry';
import { setTerrainHeight } from '../src/engine/world/terrainHeight';
import { shardContext } from '../src/game/plugin/context';
import { parseShardSlug } from '../src/game/shard/slug';
import { prepareQuestEntry } from '../src/game/quest/chapter';
import { MANIFEST as TEMPLATE } from '../src/shards/_template/discovery.generated';
import { parseQuestStory } from '../src/format/questStory';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import type { Progress } from '../src/game/Progress';
import { progressSave } from '../src/game/saves';
import { bindStoryAchievements } from '../src/game/quest/story';
import { questBenchPose } from '../src/game/quest/storyLaw';
import { PAGE_STORY as driftStory } from '../src/shards/driftwood-isle/generators/pageStory';
import { PAGE_STORY as pineStory } from '../src/shards/pine-hollow/generators/pageStory';
import { DRIFTWOOD_FEAT_COUNTERS } from '../src/shards/driftwood-isle/generators/questInventory';
import { PINE_FEAT_COUNTERS } from '../src/shards/pine-hollow/generators/questInventory';
import drift from '../src/shards/driftwood-isle/shard.config';
import pine from '../src/shards/pine-hollow/shard.config';
import * as v from 'valibot';
import { FigureRows } from '../src/game/systems/npc/figureRows';
import { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { ProductFigureCatalogue } from '../src/game/models/figureCatalogue';
import { QuestPageTalksSchema } from '../src/format/npcs';
import driftPage from '../src/shards/driftwood-isle/data/questPageComposition.json';
import pinePage from '../src/shards/pine-hollow/data/forestStory.json';

function product(source: typeof drift, story: typeof driftStory, counters: typeof DRIFTWOOD_FEAT_COUNTERS | typeof PINE_FEAT_COUNTERS) {
  const policy = { ...counters, feats: counters.feats.map(({ id, count, ...row }) => ({ id, count,
    ...('kind' in row ? { kind: row.kind } : {}), ...('event' in row ? { event: row.event } : {}), ...('variant' in row ? { variant: row.variant } : {}) })) };
  const values = new Map<string, unknown>([['quests/story.json', story], ['quests/achievements.json', policy], ['quests/services.json', { version: 1, actions: [] }]]);
  return createShardProduct({ slug: source.identity.slug, revision: source.identity.revision, shardfile: source, sections: new Map(),
    files: new Map([...values.keys()].map(name => [name, { hash: name, url: name }])),
    read: name => Promise.resolve(new TextEncoder().encode(JSON.stringify(values.get(name)))) });
}

test('DW imports old Progress counts, reloads ledger counts and pays each identity once', async () => {
  const instance = 'story-drift-progress', scope = new Scope(instance), next = new Scope(`${instance}-reload`);
  const p = product(drift, driftStory, DRIFTWOOD_FEAT_COUNTERS), refreshed: string[] = [];
  let view: Parameters<Progress['bindLedger']>[0] | undefined;
  const progress = { rows: [{ def: { id: 'crab10' }, count: 4 }], refreshLedger: () => { refreshed.push('refresh'); }, bindLedger: (value: NonNullable<typeof view>) => { view = value; } };
  try {
    const story = parseQuestStory(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await p.file('quests/story.json'))));
    const bound = await bindStoryAchievements({ app, scope, product: p }, story, progress, instance);
    expect(view?.count('crab10')).toBe(4); expect(refreshed).toHaveLength(4);
    bound.kill('crab'); expect(view?.count('crab10')).toBe(5);
    expect(view?.checkpoint()).toBe(true);
    scope.dispose();
    const reload = await bindStoryAchievements({ app, scope: next, product: p }, story, { ...progress, rows: [] }, instance);
    expect(view?.count('crab10')).toBe(5);
    reload.kill('crab'); expect(view?.count('crab10')).toBe(6);
    expect(reload.facts.achievement('crab10')?.count).toBe(6);
  } finally { scope.dispose(); next.dispose(); }
});

test('Pine replays its old saved counters, retains its record and prefixed ledger view', async () => {
  const instance = 'story-pine-progress', scope = new Scope(instance), next = new Scope(`${instance}-reload`);
  const previous = progressSave.read(instance);
  expect(progressSave.write({ ...previous, counts: { deer5: 2 } }, instance)).toBe(true);
  const p = product(pine, pineStory, PINE_FEAT_COUNTERS);
  let refreshes = 0;
  try {
    const first = await bindStoryAchievements({ app, scope, product: p }, pineStory, { refreshLedger: () => { refreshes++; } }, instance);
    expect(first.facts.achievement('pine-hollow.deer5')?.count).toBe(2); expect(refreshes).toBe(0);
    first.kill('deer'); expect(refreshes).toBe(1);
    expect(first.facts.achievement('pine-hollow.deer5')?.count).toBe(3);
    scope.dispose();
    progressSave.write({ ...previous, counts: {} }, instance);
    const reload = await bindStoryAchievements({ app, scope: next, product: p }, pineStory, undefined, instance);
    expect(reload.facts.achievement('pine-hollow.deer5')?.count).toBe(3);
    reload.kill('deer'); expect(reload.facts.achievement('pine-hollow.deer5')?.count).toBe(4);
  } finally { scope.dispose(); next.dispose(); }
});

test('story flag effects keep sync-before-notice order, filtering and entry disposal', async () => {
  const scope = new Scope('story-flags'), events: string[] = [], host = new App();
  const story = parseQuestStory({ ...driftStory, notices: [{ prefix: 'glass:', total: 2, text: 'Every piece' }] });
  const p = product(drift, story, DRIFTWOOD_FEAT_COUNTERS);
  const level = createLevelInstallation(host, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const ctx = shardContext(level.context, { ...TEMPLATE, slug: parseShardSlug(drift.identity.slug) }, { shard: TEMPLATE, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } }, p);
  Object.defineProperty(ctx.game, 'runtime', { value: { world: { registry: new WorldRegistry() }, play: { hud: { toast: (text: string) => { events.push(text); } } } } });
  const entry = await prepareQuestEntry(ctx, { story: 'quests/story.json', services: 'quests/services.json', placement: {} }), flags = entry.flags;
  expect(entry.story).toEqual(story);
  flags.reset();
  expect(() => entry.observe()).toThrow('entered achievements');
  const request = entry.achievements(); expect(entry.achievements()).toBe(request);
  const achievements = await request;
  vi.spyOn(achievements, 'syncFlags').mockImplementation(() => { events.push('sync'); });
  entry.observe();
  flags.set('plate:test'); flags.set('lever:test'); expect(events).toEqual(['sync']);
  flags.set('glass:1'); flags.set('glass:2'); expect(events).toEqual(['sync', 'sync', 'sync', 'Every piece']);
  scope.dispose(); flags.set('after:dispose'); expect(events).toHaveLength(4);
  expect(() => parseQuestStory({ ...story, journal: { ...story.journal, refresh: 'later' } })).toThrow();
  expect(() => parseQuestStory({ ...story, bench: { ...story.bench, forward: Infinity } })).toThrow();
  expect(() => parseQuestStory({ ...story, bindings: { sync: { owner: 'foreign', path: ['run'] } } })).toThrow();
});

test('page and native seats retain the original two floor laws, yaw, pitch and velocity reset', async () => {
  const at = new Vector3(4, 6, 8), yaw = .7;
  setTerrainHeight(() => 0);
  for (const [source, story, counters] of [[drift, driftStory, DRIFTWOOD_FEAT_COUNTERS], [pine, pineStory, PINE_FEAT_COUNTERS]] as const) {
    const scope = new Scope('story-seat'), host = new App(), toasts: string[] = [];
    const player = { position: new Vector3(), velocity: new Vector3(3, 4, 5), yaw: 0, pitch: 0, platforms: [(x: number, z: number) => x + z] };
    const level = createLevelInstallation(host, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
    const ctx = shardContext(level.context, { ...TEMPLATE, slug: parseShardSlug(source.identity.slug) }, { shard: TEMPLATE, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } }, product(source, story, counters));
    Object.defineProperty(ctx.game, 'runtime', { value: { world: { registry: new WorldRegistry(), player, game: { scene: new Scene() }, sky: { setupMaterial: () => undefined, csm: { lightDirection: new Vector3() } } }, interactables: [],
      play: { hud: { toast: (text: string) => { toasts.push(text); } }, audio: { voices: { play: () => undefined } } } } });
    try {
      const entry = await prepareQuestEntry(ctx, { story: 'quests/story.json', services: 'quests/services.json', placement: { platforms: true } });
      expect(() => entry.bench()).toThrow('entered interaction table');
      const kit = await entry.interact({ table: { rows: [], external: [] }, platforms: true }, { id: 'seat.kit', before: [] });
      entry.bench(); kit.onSit?.(at, yaw);
      const native = questBenchPose(story.bench, at, yaw, (x, z) => x + z);
      expect(player.position.toArray()).toEqual([native.x, native.y, native.z]);
      const x = at.x + Math.sin(yaw) * .2, z = at.z + Math.cos(yaw) * .2;
      expect(player.position.toArray()).toEqual([x, story.bench.terrain ? x + z : 6.02, z]);
      expect(player.velocity.length()).toBe(0); expect(player.yaw).toBe(yaw + Math.PI); expect(player.pitch).toBe(story.bench.pitch);
      expect(toasts).toEqual([story.bench.text]);
      scope.dispose(); expect(() => entry.bench()).toThrow('entered interaction table');
    } finally { scope.dispose(); }
  }
  expect(() => questBenchPose(driftStory.bench, at, yaw)).toThrow('floor');
});

test('an entry that leaves during named story admission never installs saved flags or services', async () => {
  const scope = new Scope('story-admission'), host = new App(), p = product(drift, driftStory, DRIFTWOOD_FEAT_COUNTERS);
  const level = createLevelInstallation(host, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const ctx = shardContext(level.context, { ...TEMPLATE, slug: parseShardSlug(drift.identity.slug) }, { shard: TEMPLATE, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } }, p);
  Object.defineProperty(ctx.game, 'runtime', { value: { world: { registry: new WorldRegistry() } } });
  const read = p.file.bind(p);
  let release = (): void => { throw new Error('Story admission did not wait'); };
  const gate = new Promise<void>(resolve => { release = resolve; });
  vi.spyOn(p, 'file').mockImplementation(async name => { await gate; return read(name); });
  const pending = prepareQuestEntry(ctx, { story: 'quests/story.json', services: 'quests/services.json', placement: {} });
  const refused = expect(pending).rejects.toThrow('left during story admission');
  scope.dispose(); release(); await refused;
});

function talkPage(source: typeof drift, story: typeof driftStory, counters: typeof DRIFTWOOD_FEAT_COUNTERS | typeof PINE_FEAT_COUNTERS) {
  const scope = new Scope('story-talk-entry'), host = new App(), swaps = vi.fn(), scene = new Scene();
  const level = createLevelInstallation(host, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const ctx = shardContext(level.context, { ...TEMPLATE, slug: parseShardSlug(source.identity.slug) }, { shard: TEMPLATE, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } }, product(source, story, counters));
  const weapons = { stowed: false };
  Object.defineProperty(ctx.game, 'runtime', { value: { world: { registry: new WorldRegistry(), game: { scene }, sky: { setupMaterial: () => undefined } },
    objects: {}, interactables: [], play: { audio: { weaponSwap: swaps }, weapons, inventory: { items: [] } } } });
  return { ctx, scope, swaps, scene, weapons };
}

test('entered talk rows borrow the actual castaway and preserve opening, stow and greeting cadence', async () => {
  const { ctx, scope, swaps, scene, weapons } = talkPage(drift, driftStory, DRIFTWOOD_FEAT_COUNTERS);
  const figure = new FigureRows(new SceneHandles({ setupMaterial: () => undefined }), {
    id: 'castaway', name: 'Wendell', feet: [0, 0, 0], yaw: 0, talkHeight: 1.4,
    collider: { kind: 'box', half: .3, top: 1.8, bottom: 0 }, rig: { skeleton: 'npc.legs.v1', clips: ['idle'], sockets: [] },
    visible: [], joints: [], sockets: [], drawDistance: 80, pointAt: [0, 0, 0], points: false,
  }, scope);
  try {
    const entry = await prepareQuestEntry(ctx, { story: 'quests/story.json', services: 'quests/services.json', placement: {} });
    entry.flags.reset();
    await expect(entry.talks({ ...driftPage.talks, models: [...driftPage.talks.models, ...driftPage.talks.models] })).rejects.toThrow('Duplicate quest talk model');
    const talks = await entry.talks(driftPage.talks), person = talks.people[0];
    if (person === undefined) throw new Error('Missing declared castaway');
    expect(person.fig).toBe(figure); expect(scene.children).toContain(figure.group);
    person.prompt.onInteract(); person.update(.1, 1, new Vector3());
    expect(swaps).toHaveBeenCalledTimes(1); expect(weapons.stowed).toBe(true);
    expect(figure.takeSignal('wave')).toBe(true);
    person.update(.1, 2, new Vector3(100, 0, 0));
    expect(weapons.stowed).toBe(false); expect(figure.talking).toBe(false);
    await expect(entry.talks(driftPage.talks)).rejects.toThrow('already installed');
  } finally { scope.dispose(); }
  expect(figure.active).toBe(false);
});

test('leaving during a catalogue read cannot create figures or dialogue on the departed page', async () => {
  const { ctx, scope, scene } = talkPage(pine, pineStory, PINE_FEAT_COUNTERS);
  const entry = await prepareQuestEntry(ctx, { story: 'quests/story.json', services: 'quests/services.json', placement: {} });
  let release = (): void => { throw new Error('Catalogue did not wait'); };
  const gate = new Promise<void>(resolve => { release = resolve; });
  const read = vi.spyOn(ProductFigureCatalogue, 'fromProduct').mockImplementation(async () => {
    await gate; return new ProductFigureCatalogue('test', 'people/catalogue.json');
  });
  try {
    const pending = entry.talks(pinePage.talks), refused = expect(pending).rejects.toThrow('left during model admission');
    scope.dispose(); release(); await refused;
    expect(read).toHaveBeenCalledWith(ctx.product, 'people/catalogue.json');
    expect(scene.children).toEqual([]);
  } finally { read.mockRestore(); scope.dispose(); }
});

test('both authored talk policies admit and reject executable model policies', () => {
  for (const rows of [pinePage.talks, driftPage.talks]) {
    expect(v.safeParse(QuestPageTalksSchema, rows).success).toBe(true);
    expect(v.safeParse(QuestPageTalksSchema, { ...rows, calls: { arbitrary: { kind: 'callback', run: 'window.alert' } } }).success).toBe(false);
  }
});
