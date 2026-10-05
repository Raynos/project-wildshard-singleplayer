import { expect, it } from 'vitest';
import { App } from '../../../src/engine/app/app';
import { createLevelInstallation } from '../../../src/engine/level/installation';
import { shardContext } from '../../../src/game/shard/context';
import { RetainedRuntimeHooks } from '../../../src/game/shard/retainedHooks';
import { emptyShardfileSource } from '../../../src/game/shardfile/loader';
import { emptyShardfile } from '../../../src/sdk/author';
import { installPineCombatCallbacks } from '../../../src/shards/pine-hollow/runtime/combatService';

it('freezes Pine encounter continuation for 600 road ticks and releases holds at both home exits', () => {
  const app = new App(), scope = app.engineScope.child('pine.encounters');
  const manifest = emptyShardfileSource(emptyShardfile({ slug: 'fixture', name: 'Fixture', author: 'Fixture', seed: 1, revision: 1 }));
  const base = createLevelInstallation(app, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const hooks = new RetainedRuntimeHooks(shardContext(base.context, manifest, { shard: manifest, rows: new Map(),
    bag: { tab: () => () => undefined, fragment: () => () => undefined } }));
  const before = app.events.census(), state = { ticks: 0, health: 55, phase: 2, held: false }, host = { app, levelScope: scope };
  let releases = 0;
  installPineCombatCallbacks(hooks.context, host, { id: 'elites', phase: 'update', run: () => { state.ticks++; state.held = true; } },
    () => { releases++; state.held = false; });
  hooks.context.on('player.jump', () => { state.health--; });
  const tick = (): void => { for (const system of app.systemsByPhase().update) system.run(1 / 60, 0); app.events.emit('player.jump', true); app.events.flush('update'); };
  try {
    for (let entry = 0; entry < 2; entry++) {
      if (entry > 0) hooks.activate();
      tick(); expect(state.held).toBe(true);
      hooks.deactivate(); expect(state.held).toBe(false);
      const frozen = { ...state };
      for (let held = 0; held < 600; held++) tick();
      expect(state).toEqual(frozen); expect(app.events.census()).toEqual(before);
      expect(app.systemIds(scope)).toEqual([]);
    }
    expect(state).toEqual({ ticks: 2, health: 53, phase: 2, held: false }); expect(releases).toBe(2);
  } finally { app.engineScope.dispose(); }
  expect(scope.census.disposers).toBe(0);
});

it('keeps the ordinary encounter registration on its original level scope', () => {
  const app = new App(), scope = app.engineScope.child('pine.legacy'); let releases = 0;
  installPineCombatCallbacks(undefined, { app, levelScope: scope }, { id: 'elites', phase: 'update', run: () => undefined }, () => { releases++; });
  expect(app.systemIds(scope)).toEqual(['elites']);
  app.engineScope.dispose(); expect(releases).toBe(0);
});
