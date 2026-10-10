// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../../../src/engine/app/scope';
import { withOwner } from '../../../src/engine/app/ownership';
import { app } from '../../../src/engine/app/runtime';
import { Flags } from '../../../src/engine/world/interact/flags';
import { DriftwoodScriptFinale, prepareDriftwoodDirector } from '../../../src/shards/driftwood-isle/runtime/scriptFinale';
import { installLegacyFinale, type FinaleWorld } from '../../fixtures/quest-oracle/driftwood-finale';
import type { AdvAnimal } from '../../../src/shards/driftwood-isle/quest/adventure';

it('preserves ten thousand shipping phase decisions and restores full author state without publishing or stepping', async () => {
  const create = await prepareDriftwoodDirector(), scope = new Scope('finale.clock.oracle');
  const flags = new Flags('script-finale', false), player = { position: new Vector3(20, 0, 0), velocity: new Vector3(), yaw: 0, pitch: 0, carried: false };
  const native: string[] = [], script: string[] = [], suffix: string[] = [], frames: ((dt: number, time: number) => void)[] = [];
  let tick = 0;
  const world: FinaleWorld<AdvAnimal> = { scope, player, sky: { planetDir: new Vector3(0, 0, 1), dayNight: { phase: 0.4 } },
    game: { onUpdate: run => { frames.push(run); } },
    animals: { spawn: (kind, x, z, yaw) => ({ kind, position: new Vector3(x, 0, z), mem: { yaw }, hp: 10, maxHp: 10, alive: true, herd: 0 }) },
    hud: { toast: text => { if (text.startsWith('Captain Brine sinks')) native.push(`${tick}:captain.dead`); } },
    music: { combat: () => { native.push(`${tick}:captain.wake`); }, sting: () => { if (player.carried) native.push(`${tick}:reward.start`); } },
  };
  const recipe = withOwner(scope, () => installLegacyFinale({ flags, spine: null, complete: null,
    place: point => ({ x: point.x, y: point.dy ?? 0, z: point.z, yaw: 0 }), floorAt: () => 0,
    setAnchor: () => { /* The production recipe computes its real reward point. */ } }, world, app));
  flags.onChange((flag, on) => { if (on && flag === 'seen:reward') native.push(`${tick}:reward.finish`); });
  const observe = () => ({ altar: Number(flags.has('used:altar')), dead: Number(flags.has('dead:captain')), seen: Number(flags.has('seen:reward')),
    'player-x': player.position.x, 'player-z': player.position.z, 'reward-x': recipe.rewardAt.x, 'reward-z': recipe.rewardAt.z });
  const clock = new DriftwoodScriptFinale(create(), { observe, publish: event => { script.push(`${tick}:${event}`); } });
  let restored: DriftwoodScriptFinale | undefined;
  const off = flags.onChange((flag, on) => { if (on && (flag === 'used:altar' || flag === 'dead:captain')) { clock.changed(); restored?.changed(); } });
  try {
    for (tick = 1; tick <= 10000; tick++) {
      if (tick === 10) flags.set('used:altar');
      if (tick === 200) {
        // Death arrives before the player moves into the ring: zero-dt dispatch must not start the reward.
        flags.set('dead:captain'); expect(script).toEqual(native);
      }
      player.position.copy(tick >= 220 ? recipe.rewardAt : new Vector3(20, 0, 0));
      clock.update(1 / 60); restored?.update(1 / 60);
      for (const frame of frames) frame(1 / 60, tick / 60);
      expect(script).toEqual(native);
      if (tick === 300) {
        const saved = clock.snapshot();
        restored = new DriftwoodScriptFinale(create(), { observe, publish: event => { suffix.push(`${tick}:${event}`); } }, true);
        restored.restore(saved); expect(suffix).toEqual([]); expect(restored.snapshot()).toBe(saved);
      }
      if (restored !== undefined && (tick === 400 || tick === 640 || tick === 10000)) expect(restored.snapshot()).toBe(clock.snapshot());
    }
    expect(script).toEqual(['10:captain.wake', '200:captain.dead', '220:reward.start', '640:reward.finish']);
    expect(suffix).toEqual(['640:reward.finish']);
  } finally { off(); scope.dispose(); document.body.replaceChildren(); }
}, 60_000);
