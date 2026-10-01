// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Texture } from 'three';
import { App, type LevelAdapters, type LevelContext, type LevelDriver } from '#engine';
import { WorldRegistry } from '#engine/world/registry';
import manifest from '#shards/nine-dragon-stack/manifest';
import { toLevelSpec } from '#game/shard/spec';

const noop = (): void => { /* No renderer work in a context contract test. */ };
const driver: LevelDriver = { progress: () => ({ set: noop, detail: noop }), data: noop, world: noop, kit: noop, loadout: noop, play: noop, finish: noop };

describe('scope-bound context service adapters', () => {
  it('publishes only scoped handles and removes them on unload and failed hooks', async () => {
    const app = new App(); app.levelDriver = driver;
    app.debug.expose('engine.fixture', 1);
    const handle = { value: 2 };
    await app.loadLevel(toLevelSpec(manifest), { world: (ctx) => { ctx.debug.expose('fixture.handle', handle); } });
    expect(app.debug.scopedSnapshot()).toEqual({ 'fixture.handle': handle });
    await app.unloadLevel();
    expect(app.debug.scopedSnapshot()).toEqual({});
    expect(app.debug.snapshot()).toEqual({ 'engine.fixture': 1 });
    await expect(app.loadLevel(toLevelSpec(manifest), { world: (ctx) => {
      ctx.debug.expose('fixture.failed', handle); throw new Error('failed hook');
    } })).rejects.toThrow('failed hook');
    expect(app.debug.scopedSnapshot()).toEqual({});
  });

  it('reverses input, every HUD verb, debug rows and playground registrations', async () => {
    const app = new App(), active = new Set<string>();
    app.registryValue = new WorldRegistry(); app.levelDriver = driver;
    const add = (id: string): (() => void) => { active.add(id); return () => { active.delete(id); }; };
    const adapters: LevelAdapters = {
      inputContext: () => add('input'), debugRow: () => add('debug'), playground: () => add('playground'),
      hud: { widget: () => add('widget'), disc: () => ({ button: document.createElement('button'), dispose: add('disc') }),
        relabel: () => add('relabel'), verb: () => add('verb'), pin: () => add('pin') },
    };
    app.levelAdapters = adapters;
    let context: LevelContext | undefined;
    await app.loadLevel(toLevelSpec(manifest), { play: (ctx) => {
      context = ctx;
      const el = document.createElement('div');
      ctx.inputContext({ id: 'fixture.input', priority: 1, enabled: () => true, actions: {} });
      ctx.hud.widget('status', el, 1); expect(ctx.hud.disc({ cls: 'fixture', spot: 'edge-l', icon: '', label: 'Fixture' })).toBeInstanceOf(HTMLButtonElement);
      ctx.hud.relabel('r0', 'Fixture', ''); ctx.hud.verb('verb.1', { label: 'Fixture', icon: '', press: noop }); ctx.hud.pin(() => null, el);
      ctx.debugRow({ id: 'fixture.debug', group: 'tools', label: 'Fixture', initial: 'off', choices: [], change: noop, note: 'E357' });
      ctx.playground({ id: 'fixture.playground', title: 'Fixture', blurb: '', icon: '', load: () => Promise.resolve({}) });
    } });
    expect(active.size).toBe(8); await app.unloadLevel(); await app.unloadLevel(); expect(active.size).toBe(0);
    expect(() => context?.hud.relabel('r0', 'Late', '')).toThrow('unloaded');
  });

  it('fails loudly when a service has no adapter and disposes earlier work', async () => {
    const app = new App(); app.levelDriver = driver;
    await expect(app.loadLevel(toLevelSpec(manifest), { world: (ctx) => {
      ctx.debug.expose('fixture', 1); ctx.playground({ id: 'fixture', title: '', blurb: '', icon: '', load: () => Promise.resolve({}) });
    } })).rejects.toThrow('Playground service is not installed');
    expect(app.debug.snapshot()).toEqual({}); expect(app.levelScope).toBeNull();
  });

  it('disposes root and piece resources added late while retaining acquired shared assets', async () => {
    const app = new App(); app.levelDriver = driver; app.registryValue = new WorldRegistry();
    let root: Group | undefined;
    const piece = new Group(), texture = new Texture(), geometry = new BoxGeometry(), material = new MeshBasicMaterial({ map: texture });
    app.assets.register('shared.texture', texture, { retain: true }); app.assets.acquire('shared.texture');
    let freed = 0, textures = 0;
    geometry.addEventListener('dispose', () => { freed++; }); texture.addEventListener('dispose', () => { textures++; });
    await app.loadLevel(toLevelSpec(manifest), { world: (ctx) => {
      root = ctx.root;
      ctx.piece({ id: 'fixture', name: 'Fixture', category: 'props', file: 'fixture.ts', object: piece });
    } });
    piece.add(new Mesh(geometry, material)); root?.add(piece);
    await app.unloadLevel(); expect(freed).toBe(1); expect(textures).toBe(0); expect(app.registry.pieces).toEqual([]);
    app.assets.release('shared.texture');
  });
});
