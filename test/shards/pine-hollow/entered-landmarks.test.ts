import { expect, it, vi } from 'vitest';
import { App } from '../../../src/engine/app/app';
import { createLevelInstallation } from '../../../src/engine/level/installation';
import { shardContext } from '../../../src/game/shard/context';
import { RetainedRuntimeHooks } from '../../../src/game/shard/retainedHooks';
import { emptyShardfileSource } from '../../../src/game/shardfile/loader';
import { emptyShardfile } from '../../../src/sdk/author';
import { installPineLandmarkUpdate } from '../../../src/shards/pine-hollow/runtime/landmarkLifetime';

it('freezes the resident landmark clock on the road and installs one callback on each entry', () => {
  const app = new App(), scope = app.engineScope.child('landmarks');
  const manifest = emptyShardfileSource(emptyShardfile({ slug: 'home', name: 'Home', author: 'Fixture', seed: 1, revision: 1 }));
  const base = createLevelInstallation(app, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const context = shardContext(base.context, manifest, { shard: manifest, rows: new Map(),
    bag: { tab: () => () => undefined, fragment: () => () => undefined } });
  const hooks = new RetainedRuntimeHooks(context);
  const onUpdate = vi.fn<(update: (dt: number, time: number) => void, label?: string) => void>();
  const update = vi.fn<(dt: number, time: number) => void>();
  const step = () => { for (const system of app.systemsByPhase().update) system.run(1 / 60, app.clock.now); };
  try {
    installPineLandmarkUpdate(hooks.context, { onUpdate }, update);
    for (let entry = 0; entry < 2; entry++) {
      if (entry > 0) hooks.activate();
      expect(app.systemIds(scope)).toEqual(['pine.landmarks']);
      step(); expect(update).toHaveBeenLastCalledWith(1 / 60, (entry + 1) / 60);
      hooks.deactivate(); expect(app.systemIds(scope)).toEqual([]);
      for (let tick = 0; tick < 600; tick++) { app.clock.tick(1 / 60); step(); }
      expect(update).toHaveBeenCalledTimes(entry + 1);
    }
    expect(onUpdate).not.toHaveBeenCalled();
    installPineLandmarkUpdate(context, { onUpdate }, update);
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith(update, 'pine.landmarks');
  } finally { scope.dispose(); app.engineScope.dispose(); }
  expect(scope.census).toMatchObject({ systems: 0, listeners: 0, disposers: 0 });
});
