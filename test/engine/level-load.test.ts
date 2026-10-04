import { describe, expect, it, vi } from 'vitest';
import { Group } from 'three';
import { App, type LevelContext, type LevelDriver, type LevelSpec } from '#engine';
import { WorldRegistry } from '#engine-internal/world/registry';
import { FakeGame } from '../fake/FakeGame';
import manifest from '#shards/nine-dragon-stack/manifest';
import { toLevelSpec } from '#game/shard/spec';

const noop = (): void => { /* The fake has no renderer work. */ };
function setup(): { app: App; fake: FakeGame; spec: LevelSpec; log: string[] } {
  const app = new App(), fake = new FakeGame(), spec = toLevelSpec(manifest), log: string[] = [];
  app.scene = fake.scene; app.render = fake.asGame(); app.registryValue = new WorldRegistry();
  const driver: LevelDriver = {
    progress: (stage) => ({ set: noop, detail: (text) => { log.push(`${stage}:${text}`); } }),
    data: () => { log.push('data'); }, world: () => { log.push('world'); }, kit: () => { log.push('kit'); },
    loadout: (_spec, ctx) => { expect(ctx.app.levelRegistrations.get('weapon', 'weapon.fixture')).toBeDefined(); log.push('loadout'); },
    play: () => { log.push('play'); }, finish: () => { log.push('finish'); },
  };
  app.levelDriver = driver;
  return { app, fake, spec, log };
}
const kit = (ctx: LevelContext): void => { ctx.rows.weapon({ id: 'weapon.fixture' }); };

describe('staged level load on the fake Game', () => {
  it('awaits each hook in order, with loadout after kit and finish after play', async () => {
    const { app, spec, log } = setup();
    await app.loadLevel(spec, {
      world: async (ctx) => { await Promise.resolve(); log.push('hook.world'); ctx.progress.detail('world done'); },
      kit: async (ctx) => { await Promise.resolve(); kit(ctx); log.push('hook.kit'); },
      play: async () => { await Promise.resolve(); log.push('hook.play'); },
    });
    expect(log).toEqual(['data', 'world', 'hook.world', 'level.world:world done', 'kit', 'hook.kit', 'loadout', 'play', 'hook.play', 'finish']);
    expect(app.state).toBe('loading');
    await app.unloadLevel();
  });

  it.each(['world', 'kit', 'play'] as const)('disposes scope and partial registrations when the %s hook rejects', async (stage) => {
    const { app, spec } = setup();
    let context: LevelContext | undefined;
    const released = vi.fn<() => void>();
    const fail = async (ctx: LevelContext): Promise<void> => {
      context = ctx;
      ctx.scope.own({ dispose: released });
      ctx.system({ id: 'fixture.system', phase: 'update', run: noop });
      ctx.piece({ id: 'fixture.piece', name: 'Fixture', category: 'props', file: 'fixture.ts', object: new Group() });
      await Promise.resolve(); throw new Error(`failed ${stage}`);
    };
    await expect(app.loadLevel(spec, { kit, [stage]: fail })).rejects.toMatchObject({ stage: `level.${stage}`, message: `failed ${stage}` });
    expect(context?.scope.disposed).toBe(true); expect(released).toHaveBeenCalledOnce();
    expect(app.registry.pieces).toEqual([]); expect(app.systemsByPhase().update).toEqual([]);
    expect(app.levelRegistrations.list('weapon')).toEqual([]); expect(app.levelScope).toBeNull(); expect(app.state).toBe('error');
  });

  it.each(['data', 'world', 'kit', 'loadout', 'play', 'finish'] as const)('disposes on a failing engine %s step', async (stage) => {
    const { app, spec } = setup();
    const driver = app.levelDriver;
    if (driver === null) throw new Error('Missing fixture driver');
    driver[stage] = (_spec, ctx) => { ctx.debug.expose('fixture', 1); throw new Error(`engine ${stage}`); };
    await expect(app.loadLevel(spec, { kit })).rejects.toThrow(`engine ${stage}`);
    expect(app.levelScope).toBeNull(); expect(app.debug.snapshot()).toEqual({});
  });

  it('unloads every scoped registration and supports a second load without a renderer', async () => {
    const { app, spec } = setup();
    const engineEvents = app.events.census();
    const onLoaded = vi.fn<() => void>(), engine = vi.fn<() => void>();
    app.addSystem({ id: 'engine.frame', phase: 'update', run: engine }, app.engineScope);
    let context: LevelContext | undefined;
    await app.loadLevel(spec, {
      world: (ctx) => {
        context = ctx; ctx.strings({ 'fixture.text': 'Hello' }); ctx.debug.expose('fixture', 1);
        ctx.piece({ id: 'fixture.piece', name: 'Fixture', category: 'props', file: 'fixture.ts' });
        ctx.system({ id: 'fixture.frame', phase: 'update', run: noop });
        ctx.on('level.loaded', onLoaded);
        ctx.tiers.knobs({ id: 'fixture.knobs', defaults: { ao: false } });
      },
      kit: (ctx) => { kit(ctx); ctx.rows.tool([{ id: 'tool.a' }, { id: 'tool.b' }]); ctx.rows.creatureLook('fixture', () => new Group()); },
    });
    app.events.flush('update'); expect(onLoaded).toHaveBeenCalledOnce();
    expect(app.levelRegistrations.text('fixture.text')).toBe('Hello'); expect(app.levelRegistrations.look('fixture')).toBeDefined();
    await app.unloadLevel();
    expect(app.registry.pieces).toEqual([]); expect(app.levelRegistrations.list('weapon')).toEqual([]);
    expect(app.levelRegistrations.list('tool')).toEqual([]); expect(app.debug.snapshot()).toEqual({});
    expect(app.levelRegistrations.knobSchemas()).toEqual([]); expect(app.levelRegistrations.look('fixture')).toBeUndefined();
    expect(app.events.census()).toEqual(engineEvents);
    expect(Object.values(context?.scope.census ?? {}).every((count) => count === 0)).toBe(true);
    for (const system of app.systemsByPhase().update) system.run(1 / 60, 0);
    expect(engine).toHaveBeenCalledOnce();
    await app.loadLevel(spec, { kit }); await app.unloadLevel();
    expect(app.events.census()).toEqual(engineEvents);
  });

  it('refuses engine rows outside kit and after unload, including callbacks retained from kit', async () => {
    const { app, spec } = setup();
    let context: LevelContext | undefined;
    await app.loadLevel(spec, {
      world: (ctx) => { expect(() => ctx.rows.tool({ id: 'bad' })).toThrow('level.kit'); },
      kit: (ctx) => { kit(ctx); context = ctx; },
      play: (ctx) => { expect(() => ctx.rows.tool({ id: 'bad' })).toThrow('level.kit'); },
    });
    expect(() => context?.rows.tool({ id: 'bad' })).toThrow('level.kit');
    await app.unloadLevel(); expect(() => context?.strings({ late: 'bad' })).toThrow('unloaded');
  });

  it('rejects duplicate array rows atomically', async () => {
    const { app, spec } = setup();
    await app.loadLevel(spec, { kit: (ctx) => {
      kit(ctx); expect(() => ctx.rows.tool([{ id: 'same' }, { id: 'same' }])).toThrow('Duplicate');
      expect(app.levelRegistrations.list('tool')).toEqual([]);
    } });
    await app.unloadLevel();
  });

  it('refuses overlapping loads and cancels a hook that resumes after unload', async () => {
    const { app, spec } = setup();
    let release = noop;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const loaded = app.loadLevel(spec, { world: async () => { await gate; }, kit });
    await expect(app.loadLevel(spec, { kit })).rejects.toThrow('Unload');
    await Promise.resolve(); await Promise.resolve();
    await app.unloadLevel(); release();
    await expect(loaded).rejects.toThrow('unloaded');
    expect(app.levelScope).toBeNull();
  });
});
