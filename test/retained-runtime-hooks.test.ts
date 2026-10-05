import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { App } from '../src/engine/app/app';
import { createLevelInstallation } from '../src/engine/level/installation';
import { WorldRegistry } from '../src/engine/world/registry';
import { withOwner } from '../src/engine/app/ownership';
import { shardContext } from '../src/game/shard/context';
import { installEnteredRuntimeService, RetainedRuntimeHooks } from '../src/game/shard/retainedHooks';
import { emptyShardfileSource } from '../src/game/shardfile/loader';
import { emptyShardfile } from '../src/sdk/author';

it('retains the borrowed world across two entries, unregisters entered callbacks and refuses late old installs', () => {
  const app = new App(); app.registryValue = new WorldRegistry();
  const scope = app.engineScope.child('home'), source = emptyShardfile({ slug: 'home', name: 'Home', author: 'Fixture', seed: 1, revision: 1 });
  const manifest = emptyShardfileSource(source), base = createLevelInstallation(app, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const context = shardContext(base.context, manifest, { shard: manifest, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } });
  const before = app.events.census(), hooks = new RetainedRuntimeHooks(context);
  const borrowedDebug = { borrowed: true }, activeDebug = { active: true };
  const restoreDebug = app.debug.scopedExpose('road.state', borrowedDebug);
  hooks.context.debug.expose('home.state', activeDebug);
  let ticks = 0, deaths = 0, lateTicks = 0;
  let activeService = 'road', installs = 0;
  installEnteredRuntimeService(hooks.context, (entered) => {
    const previous = activeService; activeService = 'home'; installs++;
    entered.onDispose(() => { activeService = previous; });
  });
  withOwner(scope, () => context.piece({ id: 'home.pier', name: 'Pier', file: 'runtime/index.ts', category: 'buildings' }));
  hooks.context.system({ id: 'home.logic', phase: 'update', run: () => {
    ticks++;
    if (ticks === 2) hooks.context.system({ id: 'home.second-entry', phase: 'update', run: () => { lateTicks++; } });
  } });
  hooks.context.on('player.respawned', () => { deaths++; });
  hooks.context.answer('player.crouch', () => ({ allowed: true, latched: false }));
  const step = (): void => { for (const system of app.systemsByPhase().update) system.run(1 / 60, ticks / 60); };
  try {
    for (let visit = 0; visit < 2; visit++) {
      if (visit > 0) hooks.activate();
      expect(activeService).toBe('home');
      expect(app.debug.snapshot()).toEqual({ 'road.state': borrowedDebug, 'home.state': activeDebug });
      step(); if (visit === 1) step(); app.events.emit('player.respawned', { at: new Vector3(), checkpoint: false }); app.events.flush('update');
      expect(app.events.ask('player.crouch', { want: true, via: 'toggle' })).toEqual({ allowed: true, latched: false });
      hooks.deactivate(); hooks.deactivate(); step(); app.events.emit('player.respawned', { at: new Vector3(), checkpoint: false }); app.events.flush('update');
      expect(activeService).toBe('road');
      expect(app.debug.snapshot()).toEqual({ 'road.state': borrowedDebug });
      expect(app.events.census()).toEqual(before); expect(app.systemIds(scope)).toEqual([]);
      expect(app.registry.pieceList().map((piece) => piece.id)).toEqual(['home.pier']);
      expect(() => hooks.context.system({ id: 'late.old', phase: 'update', run: () => undefined })).toThrow('left its cell');
    }
    expect(installs).toBe(2); expect(ticks).toBe(3); expect(deaths).toBe(2); expect(lateTicks).toBe(1);
    hooks.activate(); expect(() => hooks.context.on('player.respawned', () => undefined)).toThrow('left its cell');
  } finally { app.engineScope.dispose(); restoreDebug(); }
  expect(app.debug.snapshot()).toEqual({});
  expect(app.registry.pieceList()).toEqual([]); expect(scope.census.systems).toBe(0); expect(scope.census.disposers).toBe(0);
});
