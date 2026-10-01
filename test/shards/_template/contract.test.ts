// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { App, WorldRegistry, TabRegistry, EffectService, SaveStore, type Actor, type LevelDriver } from '#engine';
import { shardContext, toLevelSpec, purseSave, shardSave, type GameServices } from '#game';
import { Vector3 } from 'three';
import { STARTER_EFFECTS } from '#kit';
import { summaryStore } from '#game/summary';
import manifest from '#shards/_template/manifest';
import { TemplatePlugin } from '#shards/_template/plugin';
import { TemplateWhip } from '#shards/_template/weapons/TemplateWhip';
import { HUT } from '#shards/_template/layout';
import { FakeGame } from '../../fake/FakeGame';

const noop = (): void => undefined;
async function boot(): Promise<{ app: App; plugin: TemplatePlugin; stages: string[]; active: Set<string>; bag: TabRegistry; fake: FakeGame }> {
  const fake = new FakeGame();
  const app = new App(), plugin = new TemplatePlugin(), stages: string[] = [], active = new Set<string>(), bag = new TabRegistry();
  const game: GameServices = { shard: manifest, rows: new Map(), bag };
  app.registryValue = new WorldRegistry();
  const add = (name: string): (() => void) => { active.add(name); return () => { active.delete(name); }; };
  app.levelAdapters = { inputContext: (def) => { const scope = app.levelScope; if (scope === null) throw new Error('No input scope'); app.input.register(def, scope); app.input.push(def.id, scope); return add(def.id); },
    debugRow: () => add('debug'), playground: () => add('playground'), hud: { widget: () => add('widget'), pin: () => add('pin'), relabel: () => add('relabel'),
      verb: () => add('verb'), disc: () => ({ button: document.createElement('button'), dispose: add('disc') }) } };
  const stage = (id: string): void => { stages.push(id); };
  const driver: LevelDriver = { progress: () => ({ set: noop, detail: noop }), data: () => stage('data'), world: () => stage('world'), kit: () => stage('kit'),
    loadout: (_spec, ctx) => { stage('loadout'); expect(ctx.app.levelRegistrations.list('weapon').map((r) => r.id)).toEqual(['weapon.sword-iron', 'weapon.template-whip']); },
    play: () => stage('play'), finish: () => stage('finish') };
  app.levelDriver = driver;
  await app.loadLevel(toLevelSpec(manifest), { world: (ctx) => plugin.world(shardContext(ctx, manifest, game)), kit: (ctx) => plugin.kit(shardContext(ctx, manifest, game)), play: (ctx) => plugin.play(shardContext(ctx, manifest, game)) });
  fake.onUpdate((dt, time) => { for (const system of app.systemsByPhase().update) system.run(dt, time); });
  app.setState('play'); return { app, plugin, stages, active, bag, fake };
}
describe('template plugin contract', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  it('boots every boundary and tears down registrations, resources and services', async () => {
    const { app, plugin, stages, active, bag } = await boot();
    expect(stages).toEqual(['data', 'world', 'kit', 'loadout', 'play', 'finish']);
    expect(manifest.uses).toHaveLength(15); expect(manifest.assets).toBeUndefined(); expect(manifest.ktx2).toBeUndefined();
    expect(plugin.propCount).toBe(10); expect(app.registry.pieces).toHaveLength(4); expect(app.levelRegistrations.list('species')).toHaveLength(2);
    expect(app.levelRegistrations.text('reach')).toBe('Reach the hut'); expect(app.debug.scopedSnapshot()['template']).toBe(plugin);
    expect(bag.registeredTabs.map((t) => t.id)).toEqual(['notes']);
    plugin.door?.onInteract(); expect(plugin.door?.label).toBe('Close hut door');
    const scope = app.levelScope; if (scope === null) throw new Error('No scope');
    const resources = scope.census; expect(resources.disposers).toBeGreaterThan(0);
    await app.unloadLevel(); expect(active.size).toBe(0); expect(bag.registeredTabs).toEqual([]); expect(app.registry.pieces).toEqual([]);
    expect(app.levelRegistrations.list('weapon')).toEqual([]); expect(app.debug.scopedSnapshot()).toEqual({});
  });
  it('routes a lantern input press and rewards the ordered hut/blob quest once', async () => {
    const { app, plugin, fake } = await boot(), purse = shardSave(purseSave, manifest.slug); const before = purse.read();
    app.input.press('template.lantern.toggle'); for (const system of app.systemsByPhase().update) system.run(1 / 30, 0); expect(plugin.lantern.lit).toBe(true);
    plugin.player.set(HUT.x, 0, HUT.doorZ); for (const system of app.systemsByPhase().update) system.run(1 / 30, 1); expect(plugin.quest?.index).toBe(1);
    const actor: Actor = { id: 'template.blob', tags: ['actor.creature', 'creature.greyBlob'], state: [], attributes: { health: 0, maxHealth: 60 }, alive: false, applyDamage: () => true };
    app.events.emit('actor.died', { actor, req: { source: 'env', sourceTags: ['weapon.template-whip'], target: actor, amount: 60, point: new Vector3(), dir: new Vector3() } }); app.events.flush('update');
    expect(plugin.quest?.isComplete).toBe(true); for (let i = 0; i < 90; i++) fake.advance(1 / 30);
    expect(fake.dead).toBe(false); expect(purse.read()).toBe(before + 5); await app.unloadLevel();
  });
  it('keeps hidden-shard saves out of the production summary', () => {
    const reads: string[] = [];
    summaryStore(new SaveStore({ local: null, session: null }), (slug) => { reads.push(slug); return null; }).read();
    expect(reads).not.toContain(manifest.slug); expect(reads).toHaveLength(4);
  });
  it('heavy contacts use a lane, reject outside it, and apply kit poison', async () => {
    const { app } = await boot(); const scope = app.levelScope; if (scope === null) throw new Error('No scope');
    app.registerEffects(new EffectService(STARTER_EFFECTS, scope, app.events), scope);
    const actor: Actor = { id: 'template.target', tags: ['actor.creature'], state: [], attributes: { health: 100, maxHealth: 100 }, alive: true,
      applyDamage: (req) => { actor.attributes.health -= req.amount; return false; } };
    const whip = new TemplateWhip(app); whip.strike(actor, new Vector3(2, 0, -3), new Vector3(0, 0, -1), new Vector3(), true); expect(actor.attributes.health).toBe(100);
    whip.strike(actor, new Vector3(0, 0, -3), new Vector3(0, 0, -1), new Vector3(), true); expect(actor.attributes.health).toBe(70); expect(app.effects?.has(actor, 'status.poison')).toBe(true);
    await app.unloadLevel();
  });
});
