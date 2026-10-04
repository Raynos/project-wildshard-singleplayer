import { expect, it } from 'vitest';
import { App } from '../src/engine/app/app';
import { Scene } from 'three';
import { loadShardfile, shardfileLevelSpec } from '../src/game/shardfile/loader';
import { emptyShardfile } from '@wildshard/sdk/author';

const empty = () => emptyShardfile({ slug: 'outside-example', name: 'Outside', author: 'Local', seed: 1, revision: 1 });
it('loads an empty shardfile through the existing driver and unloads without scope leaks over 20 cycles', async () => {
  const app = new App(), scene = new Scene(), stages: string[] = [];
  app.scene = scene;
  app.levelDriver = {
    progress: () => ({ set: () => undefined, detail: () => undefined }),
    data: () => { stages.push('data'); }, world: (_spec, ctx) => { stages.push('world'); scene.add(ctx.root); },
    kit: () => { stages.push('kit'); }, loadout: () => { stages.push('loadout'); },
    play: () => { stages.push('play'); }, finish: () => { stages.push('finish'); },
  };
  const census = app.engineScope.census;
  for (let i = 0; i < 20; i++) {
    await loadShardfile(app, empty());
    expect(app.levelScope?.disposed).toBe(false); expect(scene.children).toHaveLength(1);
    expect(scene.children[0]?.children).toEqual([]);
    await app.unloadLevel(); await app.unloadLevel();
    expect(scene.children).toEqual([]); expect(app.levelScope).toBeNull();
    expect(app.engineScope.census).toEqual(census);
  }
  expect(stages).toHaveLength(120);
});
it('refuses future versions and unsupported content before invoking a driver', async () => {
  const app = new App();
  await expect(loadShardfile(app, { ...empty(), version: 1 })).rejects.toThrow('compatible client');
  const source = empty(); source.look.families.push('toon');
  await expect(loadShardfile(app, source)).rejects.toThrow('empty shardfiles only');
  const ui = empty(); ui.ui.push({ kind: 'marker', id: 'marker', label: 'Marker', at: [0, 0, 0] });
  await expect(loadShardfile(app, ui)).rejects.toThrow('empty shardfiles only');
  expect(app.levelScope).toBeNull(); expect(shardfileLevelSpec(empty()).loadout.start).toEqual([]);
});
