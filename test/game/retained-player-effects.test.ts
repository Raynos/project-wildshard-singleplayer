// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { App } from '../../src/engine/app/app';
import { EffectService } from '../../src/engine/combat/effects/EffectService';
import { PlayerHealth } from '../../src/engine/combat/health';
import { createLevelInstallation } from '../../src/engine/level/installation';
import type { DebugRowSpec } from '../../src/engine/level/context';
import { hudSlots } from '../../src/engine/ui/hudSlots';
import { shardContext } from '../../src/game/shard/context';
import { installEnteredRuntimeService, installRetainedPlayerEffects, RetainedRuntimeHooks } from '../../src/game/shard/retainedHooks';
import { emptyShardfileSource } from '../../src/game/shardfile/loader';
import { installStarterEffects } from '../../src/kit/effects/install';
import { STARTER_EFFECTS } from '../../src/kit/effects/starter';
import { emptyShardfile } from '../../src/sdk/author';

it('keeps one player damage/movement binding on the road and recreates only the entered status UI', () => {
  const app = new App(), scope = app.engineScope.child('home'), slots = hudSlots.snapshot();
  app.levelScope = scope; app.setState('play');
  const source = emptyShardfileSource(emptyShardfile({ slug: 'home', name: 'Home', author: 'Fixture', seed: 1, revision: 1 }));
  const rows: DebugRowSpec[] = [];
  const base = createLevelInstallation(app, scope, { debugRow: (row) => { rows.push(row); return () => undefined; } }, () => ({ set: () => undefined, detail: () => undefined }));
  const context = shardContext(base.context, source, { shard: source, rows: new Map(),
    bag: { tab: () => () => undefined, fragment: () => () => undefined } });
  const hooks = new RetainedRuntimeHooks(context);
  const player = { position: new Vector3(), effectMoveLocked: false, effectMoveScale: 1 };
  const health = new PlayerHealth(app.events, { now: () => 0, position: () => player.position, dodging: () => false, dodgeGuard: () => true });
  const effects = new EffectService(STARTER_EFFECTS, scope, app.events);
  app.registerPlayer(health, scope); app.registerEffects(effects, scope); app.combat.playerRules(scope, { target: health });
  const layer = document.createElement('div'), status = document.createElement('div');
  layer.append(status); document.body.append(layer); hudSlots.mount(layer, status);
  const step = (dt: number): void => { for (const system of app.systemsByPhase().update) if (system.when?.(app) !== false) system.run(dt, 0); };
  try {
    installRetainedPlayerEffects(hooks.context, { movement: player, position: () => player.position });
    expect(() => installRetainedPlayerEffects(hooks.context, { movement: player, position: () => player.position })).toThrow('already bound');
    installStarterEffects(hooks.context, { player, health, effects }, (install) => { installEnteredRuntimeService(hooks.context, install); });
    effects.apply(health, 'effect.poison'); effects.apply(health, 'effect.slow');
    for (let entry = 0; entry < 2; entry++) {
      if (entry > 0) hooks.activate();
      step(0.25); expect(status.querySelectorAll('.ws-status-effects')).toHaveLength(1);
      expect(player.effectMoveScale).toBe(0.6);
      const residentDisposers = scope.census.disposers;
      hooks.deactivate(); expect(status.children).toHaveLength(0);
      expect(app.systemIds(scope)).toEqual(['engine.effects']);
      const hp = health.attributes.health;
      step(1); expect(health.attributes.health).toBe(hp - 3);
      expect(player.effectMoveScale).toBe(0.6);
      expect(scope.census.disposers).toBeLessThan(residentDisposers);
    }
    step(0.5); expect(player.effectMoveScale).toBe(1);
    step(3); expect(health.attributes.health).toBe(82);
    expect(effects.active(health)).toEqual([]);
    expect(status.children).toHaveLength(0);
    expect(rows.filter((row) => row.id === 'effects.apply')).toHaveLength(1);
    effects.apply(health, 'effect.slow'); effects.apply(health, 'effect.poison');
    app.events.emit('player.died', { actor: health, checkpoint: false }); app.events.flush('update');
    expect(effects.active(health)).toEqual([]); expect(player.effectMoveScale).toBe(1);
  } finally { scope.dispose(); app.engineScope.dispose(); layer.remove(); hudSlots.restore(slots); }
  expect(scope.census).toMatchObject({ systems: 0, listeners: 0, nodes: 0, timers: 0, disposers: 0 });
  expect(player.effectMoveScale).toBe(1); expect(player.effectMoveLocked).toBe(false);
});
