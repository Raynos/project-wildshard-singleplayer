// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../../../src/engine/app/scope';
import { withOwner } from '../../../src/engine/app/ownership';
import { app } from '../../../src/engine/app/runtime';
import { Flags } from '../../../src/engine/world/interact/flags';
import { DriftwoodScriptFinale, prepareDriftwoodDirector, driftwoodDirectorBytes } from '../../../src/shards/driftwood-isle/runtime/scriptFinale';
import { installLegacyFinale, type FinaleWorld } from '../../fixtures/quest-oracle/driftwood-finale';
import { prepareDirectorModule } from '../../../src/game/shardfile/directorRuntime';
import { director } from '../../../src/sdk/director';
import declaration from '../../../src/shards/driftwood-isle/data/director.json' with { type: 'json' };
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


it('admits real road-side pre-entry and re-entry observations without starting the reward early', async () => {
  const create = await prepareDriftwoodDirector();
  const prior = await prepareDirectorModule(director({ ...declaration, inputs: declaration.inputs.map(row => row.key === 'player-x' || row.key === 'player-z' ? { key: row.key, min: -250, max: 250 } : row) }), driftwoodDirectorBytes());
  // Exact failed return: only player-x lies outside the former cell-only observation range.
  expect(() => new DriftwoodScriptFinale(prior(357), { observe: () => ({ altar: 0, dead: 0, seen: 0, 'player-x': -256.631, 'player-z': -0.066, 'reward-x': -96.21572111113656, 'reward-z': 105.52632596242425 }), publish: () => undefined })).toThrow('Invalid director observation');
  for (const [x, z] of [[-256.631, -0.066], [256.631, 0.066], [0, -256.631], [0, 256.631], [-10000, 10000]]) {
    const events: string[] = [];
    const observe = () => ({ altar: 1, dead: 0, seen: 0, 'player-x': x ?? 0, 'player-z': z ?? 0, 'reward-x': -96.21572111113656, 'reward-z': 105.52632596242425 });
    const clock = new DriftwoodScriptFinale(create(), { observe, publish: event => { events.push(event); } });
    expect(events).toEqual(['captain.restore']);
    clock.update(1 / 30);
    expect(events).toEqual(['captain.restore']);
    const completed = new DriftwoodScriptFinale(create(), { observe: () => ({ ...observe(), dead: 1 }), publish: event => { events.push(event); } });
    completed.update(1 / 30);
    expect(events).toEqual(['captain.restore']);
  }
  for (const x of [Number.NaN, Infinity, 10001, -10001]) {
    expect(() => new DriftwoodScriptFinale(create(), { observe: () => ({ altar: 0, dead: 0, seen: 0, 'player-x': x, 'player-z': 0, 'reward-x': -96, 'reward-z': 105 }), publish: () => undefined })).toThrow('Invalid director observation');
  }
});
