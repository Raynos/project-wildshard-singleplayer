import { achievementsFor } from '#game/achievements';
import { describe, expect, it, vi } from 'vitest';
import { App, type LevelDriver } from '#engine';
import { ShardPlugin, type ShardContext, type GameServices } from '#game';
import manifest from '#shards/nine-dragon-stack/manifest';
import { loadShardPlugin } from '#game/shard/pluginLoad';

const noop = (): void => { /* No rendering in this node contract. */ };
const driver: LevelDriver = { progress: () => ({ set: noop, detail: noop }), data: noop, world: noop, kit: noop, loadout: noop, play: noop, finish: noop };
const adapters = (): GameServices => ({ shard: manifest, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } });

describe('game plugin adapter and load failure screen', () => {
  it('gives all hooks the same scope-bound context and unloads game rows and Bag contributions', async () => {
    const app = new App(); app.levelDriver = driver;
    const previousFeats = achievementsFor(manifest.slug);
    const game = adapters(), seen: ShardContext[] = [], active = new Set<string>();
    game.bag.tab = (spec) => { active.add(spec.id); return () => { active.delete(spec.id); }; };
    game.bag.fragment = (_tab, fragment) => { active.add(fragment.id); return () => { active.delete(fragment.id); }; };
    class Plugin extends ShardPlugin {
      override world(ctx: ShardContext): void { seen.push(ctx); ctx.strings({ fixture: 'Hello' }); }
      override kit(ctx: ShardContext): void { seen.push(ctx); ctx.rows.item([{ id: 'item.a' }, { id: 'item.b' }]); ctx.rows.places({ id: 'place.a' }); ctx.rows.feat({ id: 'kit.feat', name: 'A feat', goal: 'Do it', count: 1, title: 'Done', icon: 'check' }); }
      override play(ctx: ShardContext): void {
        seen.push(ctx); ctx.bag.tab({ id: 'finds', title: 'Finds' }); ctx.bag.fragment('finds', { id: 'fragment.a', render: noop });
        expect(() => ctx.rows.feat({ id: 'late', name: 'Late', goal: 'Test', count: 1, title: 'Title', icon: 'check' })).toThrow('level.kit');
      }
    }
    const selected = { ...manifest, load: () => Promise.resolve({ default: Plugin }) };
    const report = vi.fn<() => Promise<void>>(() => Promise.resolve()), show = vi.fn<() => void>();
    await loadShardPlugin(app, selected, game, { build: 'fixture', dispose: () => app.unloadLevel(), report, show });
    expect(seen).toHaveLength(3); expect(seen[0]).toBe(seen[1]); expect(seen[1]).toBe(seen[2]); expect(seen[0]?.manifest).toBe(selected);
    expect(achievementsFor(manifest.slug).map((row) => row.id)).toEqual(['kit.feat']); expect(game.rows.get('item')?.size).toBe(2); expect(active.size).toBe(2); expect(report).not.toHaveBeenCalled();
    await app.unloadLevel(); expect(achievementsFor(manifest.slug)).toBe(previousFeats); expect(game.rows.size).toBe(0); expect(active.size).toBe(0);
  });

  it.each(['world', 'kit', 'play'] as const)('reports the full stack and exact %s stage after disposal', async (hook) => {
    const app = new App(); app.levelDriver = driver;
    let context: ShardContext | undefined;
    class Plugin extends ShardPlugin {}
    Plugin.prototype[hook] = (ctx: ShardContext): void => { context = ctx; ctx.debug.expose('fixture', 1); throw new Error(`fixture ${hook}`); };
    const selected = { ...manifest, load: () => Promise.resolve({ default: Plugin }) };
    const report = vi.fn<() => Promise<void>>(() => Promise.resolve());
    const show = vi.fn((failure: { stage: string; stack: string }): void => {
      expect(context?.scope.disposed).toBe(true); expect(app.debug.snapshot()).toEqual({});
      expect(failure.stage).toBe(`level.${hook}`); expect(failure.stack).toContain(`fixture ${hook}`);
    });
    await expect(loadShardPlugin(app, selected, adapters(), { build: 'fixture', dispose: () => app.unloadLevel(), report, show })).rejects.toThrow(`fixture ${hook}`);
    expect(report).toHaveBeenCalledOnce(); expect(show).toHaveBeenCalledOnce();
  });

  it('reports a rejected plugin import before attempting the first level stage', async () => {
    const app = new App(), report = vi.fn<() => Promise<void>>(() => Promise.resolve()), show = vi.fn<() => void>();
    const selected = { ...manifest, load: () => Promise.reject(new Error('import failed')) };
    const dispose = vi.fn<() => void>();
    await expect(loadShardPlugin(app, selected, adapters(), { build: 'fixture', dispose, report, show })).rejects.toMatchObject({ stage: 'manifest.load' });
    expect(dispose).toHaveBeenCalledOnce(); expect(report).toHaveBeenCalledOnce(); expect(show).toHaveBeenCalledOnce();
  });
});
