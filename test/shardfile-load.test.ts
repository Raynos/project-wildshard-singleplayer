// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { App } from '../src/engine/app/app';
import { Scene } from 'three';
import { configuredShardfile, loadShardfile, shardfileLevelSpec } from '../src/game/shardfile/loader';
import { emptyShardfile } from '@wildshard/sdk/author';
import { SHARDFILE_ADMISSION_LIMITS as limits } from '../src/game/shardfile/admissionLimits';

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
it('preflights compatibility inputs without reading an authored version getter', async () => {
  let reads = 0;
  const source = empty(); Object.defineProperty(source, 'version', { enumerable: true, get() { reads++; return 1; } });
  const app = new App();
  await expect(loadShardfile(app, source)).rejects.toThrow(/JSON|accessor/u);
  expect(reads).toBe(0); expect(app.levelScope).toBeNull();
});
it('bounds inline sources by actual UTF-8 bytes before parsing them', () => {
  const element = document.createElement('script'); element.id = 'ws-shardfile'; document.body.append(element);
  try {
    element.textContent = 'x'.repeat(limits.sourceBytes + 1);
    expect(() => configuredShardfile(document)).toThrow('source exceeds admission cap');
    element.textContent = 'é'.repeat(limits.sourceBytes / 2 + 1);
    expect(() => configuredShardfile(document)).toThrow('source exceeds admission cap');
    element.textContent = JSON.stringify(empty());
    expect(configuredShardfile(document)?.identity.slug).toBe('outside-example');
  } finally { element.remove(); }
});
