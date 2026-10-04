// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { App, type LevelDriver } from '#engine';
import { Audio } from '#engine-internal/audio/Audio';
import { Music } from '#engine-internal/audio/Music';
import { WorldRegistry } from '#engine-internal/world/registry';
import { shardContext, toLevelSpec, type GameServices } from '#game';
import manifest from '#shards/nine-dragon-stack/manifest';
import { installAudio } from '#shards/nine-dragon-stack/audio/ambience';

const noop = (): void => { /* Test only the kit service registration. */ };
describe('plugin audio lifecycle', () => {
  it('installs a score and own beds without a live context, then releases registrations across unload/reload', async () => {
    const app = new App(), audio = new Audio(), music = new Music(audio);
    app.audio = audio; audio.music = music; app.registryValue = new WorldRegistry();
    const driver: LevelDriver = { progress: () => ({ set: noop, detail: noop }), data: noop, world: noop, kit: noop, loadout: noop, play: noop, finish: noop };
    app.levelDriver = driver;
    const game: GameServices = { shard: manifest, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } };
    for (let attempt = 0; attempt < 2; attempt++) {
      await app.loadLevel(toLevelSpec(manifest), { kit: async (ctx) => { await installAudio(shardContext(ctx, manifest, game)); } });
      expect(audio.ready).toBe(false);
      expect(music.scoreId).toBe('score.nd');
      expect(audio.bedIds).toEqual(['bed.nd.market', 'bed.nd.well']);
      expect(audio.stepSurface?.()).toBe('rock');
      expect(app.systemsByPhase().update.map((system) => system.id)).toEqual(['shard.nd.audio']);
      expect(app.debug.scopedSnapshot()['nd.audio']).toBeDefined();
      await app.unloadLevel();
      expect(audio.ready).toBe(false); expect(audio.bedIds).toBeUndefined(); expect(music.scoreId).toBeUndefined();
      expect(app.systemsByPhase().update).toEqual([]); expect(app.debug.scopedSnapshot()).toEqual({});
    }
  });
});
