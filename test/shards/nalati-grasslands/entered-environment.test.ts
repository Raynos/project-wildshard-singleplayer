import { expect, it } from 'vitest';
import { App } from '../../../src/engine/app/app';
import { createLevelInstallation } from '../../../src/engine/level/installation';
import { RetainedRuntimeHooks } from '../../../src/game/shard/retainedHooks';
import { shardContext } from '../../../src/game/shard/context';
import { emptyShardfileSource } from '../../../src/game/shardfile/loader';
import { emptyShardfile } from '../../../src/sdk/author';
import { wildEnv } from '../../../src/shards/nalati-grasslands/creatures/env';
import { bindEnteredEnvironment } from '../../../src/shards/nalati-grasslands/runtime/enteredEnvironment';

it('restores the road environment and retains creature state across two home entries', () => {
  const app = new App(), resident = app.engineScope.child('nalati'), before = Object.getOwnPropertyDescriptors(wildEnv);
  const manifest = emptyShardfileSource(emptyShardfile({ slug: 'fixture', name: 'Fixture', author: 'Fixture', seed: 1, revision: 1 }));
  const installation = createLevelInstallation(app, resident, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const hooks = new RetainedRuntimeHooks(shardContext(installation.context, manifest, { shard: manifest, rows: new Map(),
    bag: { tab: () => () => undefined, fragment: () => () => undefined } }));
  const bindings = { grassHeightAt: () => 2, grassStandingAt: () => 3, trample: () => undefined,
    wetAt: () => true, onEvent: () => undefined, onKnockdown: () => undefined };
  bindEnteredEnvironment(hooks.context, bindings);
  try {
    for (let visit = 0; visit < 2; visit++) {
      if (visit > 0) hooks.activate();
      expect(wildEnv.onEvent).toBe(bindings.onEvent); expect(wildEnv.grassHeightAt(0, 0)).toBe(2);
      if (visit === 0) { wildEnv.lastShotT = 42; wildEnv.wind.x = 0.25; }
      else { expect(wildEnv.lastShotT).toBe(42); expect(wildEnv.wind.x).toBe(0.25); }
      hooks.deactivate(); expect(Object.getOwnPropertyDescriptors(wildEnv)).toEqual(before);
    }
  } finally { app.engineScope.dispose(); Object.defineProperties(wildEnv, before); }
  expect(resident.census.disposers).toBe(0);
});
