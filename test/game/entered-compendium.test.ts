// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { app } from '../../src/engine/app/runtime';
import { withOwner } from '../../src/engine/app/ownership';
import { PlayerHealth } from '../../src/engine/combat/health';
import type { DamageRequest } from '../../src/engine/combat/pipeline';
import type { Animal } from '../../src/engine/entities/AnimalView';
import type { AnimalManager } from '../../src/engine/entities/AnimalManager';
import { createLevelInstallation } from '../../src/engine/level/installation';
import { GameMenu } from '../../src/engine/ui/Menu';
import type { FullMap } from '../../src/engine/ui/Map';
import type { HUD } from '../../src/engine/ui/HUD';
import { BagMenu } from '../../src/game/bag/tabs';
import { installCompendium } from '../../src/game/compendium/install';
import { registerCompendium } from '../../src/game/compendium/registry';
import { Inventory } from '../../src/game/Inventory';
import { Progress } from '../../src/game/Progress';
import { shardContext } from '../../src/game/shard/context';
import { RetainedRuntimeHooks } from '../../src/game/shard/retainedHooks';
import { emptyShardfileSource } from '../../src/game/shardfile/loader';
import { emptyShardfile } from '../../src/sdk/author';
import { legacyDouble } from '../fake/FakeGame';

it('retains discovery and one trophy wall while two entries retire the actual journal, bag, input, kill and frame registrations', () => {
  vi.useFakeTimers();
  const scope = app.engineScope.child('journal-lifetime');
  const manifest = emptyShardfileSource(emptyShardfile({ slug: 'fixture', name: 'Fixture', author: 'Fixture', seed: 1, revision: 1 }));
  const installation = createLevelInstallation(app, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const hooks = new RetainedRuntimeHooks(shardContext(installation.context, manifest, { shard: manifest, rows: new Map(),
    bag: { tab: () => () => undefined, fragment: () => () => undefined } }));
  const map = legacyDouble<FullMap>({ mount: () => undefined, show: () => undefined, hide: () => undefined, fit: () => undefined,
    zoom: 1, hasRoom: false, quest: null });
  const menu = withOwner(scope, () => new GameMenu({ fullMap: map, settings: () => ({ weapons: new Set(), melee: false, tracers: false, huntersEye: false }) }));
  new BagMenu(menu, { progress: new Progress('fixture'), inventory: new Inventory('fixture'), kit: () => [] });
  const baseline = menu.scope.census, events = app.events.census();
  const health = new PlayerHealth(app.events, { now: () => 0, dodging: () => false, dodgeGuard: () => false, position: () => new Vector3() });
  const animal = legacyDouble<Animal>({ alive: false, kind: 'deer', scale: 1, variant: '', combatActor: () => health });
  let wallBuilds = 0, wallTicks = 0, resumes = 0, paused = 0;
  let openWall: (id?: string) => void = () => undefined;
  const hud = legacyDouble<HUD>({ entered: true, holdPause: false, toast: () => undefined,
    onResume: () => { resumes++; }, setPaused: () => { paused++; } });
  const unregister = registerCompendium({ chunkId: 'fixture', skin: { className: 'fixture', title: 'Journal', tabs: [{ id: 'beasts', label: 'Beasts' }],
    trophyTab: 'trophies', stamp: () => 'Taken', stats: () => [] }, entries: [{ id: 'deer', kind: 'species', tab: 'beasts', name: 'Deer',
      notes: 'A deer', match: { kind: 'deer' }, plate: { sketch: '/fixture.jpg' } }] });
  try {
    const book = installCompendium({ context: hooks.context, chunkId: 'fixture', camera: new PerspectiveCamera(), hud, menu,
      animals: legacyDouble<AnimalManager>({ animals: [animal] }), cabins: null, interactables: [], weapons: { setEnabled: () => undefined },
      touchUi: () => true, nolock: false, game: { onUpdate: () => { throw new Error('Retained journal cannot add a page updater'); } },
      wall: (_state, journal) => { wallBuilds++; openWall = journal.open; return { refresh: () => undefined, update: () => { wallTicks++; } }; },
    });
    if (book === null) throw new Error('Missing fixture journal');
    const step = () => { for (const system of app.systemsByPhase().update) system.run(1 / 60, 0); };
    const kill = () => { app.events.emit('actor.died', { actor: health, req: legacyDouble<DamageRequest>({}) }); app.events.flush('update'); };
    let old: typeof book.journal | undefined;
    for (let entry = 0; entry < 2; entry++) {
      if (entry > 0) hooks.activate();
      const journal = book.journal;
      expect(journal).not.toBe(old); expect(menu.root.querySelector('[data-tab="finds"]')).not.toBeNull();
      openWall('deer'); expect(journal.isOpen).toBe(true); journal.close();
      openWall('deer'); kill(); step(); expect(book.state.stats('deer').taken).toBe(entry + 1);
      hooks.deactivate(); old = journal;
      expect(journal.scope.disposed).toBe(true); expect(journal.root.isConnected).toBe(false);
      expect(hud.holdPause).toBe(false); expect(menu.root.querySelector('[data-tab="finds"]')).toBeNull();
      expect(menu.scope.census).toEqual(baseline); expect(app.events.census()).toEqual(events);
      const frozenTicks = wallTicks;
      vi.advanceTimersByTime(5000); openWall('deer'); kill();
      app.input.executeCommand({ kind: 'press', action: 'journal', at: 1 });
      for (let frame = 0; frame < 600; frame++) step();
      expect(book.state.stats('deer').taken).toBe(entry + 1); expect(wallTicks).toBe(frozenTicks);
      expect(paused).toBe(0); expect(resumes).toBe(entry + 1); expect(app.systemIds(scope)).toEqual([]);
    }
    expect(wallBuilds).toBe(1);
  } finally { unregister(); scope.dispose(); vi.useRealTimers(); }
  expect(scope.census).toMatchObject({ listeners: 0, timers: 0, disposers: 0, nodes: 0 });
});
