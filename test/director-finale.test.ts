// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- Replay admits the committed author module, not a replacement implementation.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { withOwner } from '../src/engine/app/ownership';
import { Flags } from '../src/engine/world/interact/flags';
import { parseDirector } from '../src/game/shardfile/director';
import { createDirectorLane } from '../src/game/shardfile/directorRuntime';
import type { FinaleWorld } from '../src/shards/driftwood-isle/quest/Finale';
import { app } from '../src/engine/app/runtime';
import { installLegacyFinale } from './fixtures/quest-oracle/driftwood-finale';
import type { AdvAnimal } from '../src/shards/driftwood-isle/quest/adventure';
import declaration from '../src/shards/driftwood-isle/data/director.json';

it('SF24 compares every director event tick with the actual shipping Driftwood finale over 10,000 ticks', async () => {
  const data = parseDirector(declaration), lane = await createDirectorLane(data, readFileSync(`src/shards/driftwood-isle/assets/${data.module}`), 357);
  const scope = new Scope('finale.oracle'), flags = new Flags('driftwood-isle', false);
  const player = { position: new Vector3(20, 0, 0), velocity: new Vector3(), yaw: 0, pitch: 0, carried: false };
  const updates: ((dt: number, time: number) => void)[] = [], legacy: { tick: number; key: string }[] = [], directed: typeof legacy = [];
  let tick = 0, updating = false;
  const emit = (key: string): void => { legacy.push({ tick, key }); };
  const world: FinaleWorld<AdvAnimal> = {
    scope, player, sky: { planetDir: new Vector3(0, 0, 1), dayNight: { phase: 0.4 } },
    game: { onUpdate: (run) => { updates.push(run); } },
    animals: { spawn: (kind, x, z, yaw) => ({ kind, position: new Vector3(x, 0, z), mem: { yaw }, hp: 10, maxHp: 10, alive: true, herd: 0 }) },
    hud: { toast: (text) => { if (text.startsWith('Captain Brine sinks')) emit('captain.dead'); } },
    music: { combat: () => { emit('captain.wake'); }, sting: () => { if (updating) emit('reward.start'); } },
  };
  const finale = withOwner(scope, () => installLegacyFinale({ flags, spine: null, complete: null,
    place: (point) => ({ x: point.x, y: point.dy ?? 0, z: point.z, yaw: 0 }),
    floorAt: () => 0, setAnchor: () => { /* Placement is exercised by installFinale; markers are outside this event replay. */ },
  }, world, app));
  flags.onChange((flag, on) => { if (on && flag === 'seen:reward') emit('reward.finish'); });
  const observe = () => ({ altar: Number(flags.has('used:altar')), dead: Number(flags.has('dead:captain')), seen: Number(flags.has('seen:reward')),
    'player-x': player.position.x, 'player-z': player.position.z, 'reward-x': finale.rewardAt.x, 'reward-z': finale.rewardAt.z });
  expect(lane.step(0, observe())).toEqual([]);
  try {
    for (tick = 1; tick <= 10000; tick++) {
      if (tick === 10) flags.set('used:altar');
      if (tick === 200) flags.set('dead:captain');
      player.position.copy(tick >= 220 ? finale.rewardAt : new Vector3(20, 0, 0));
      const events = lane.step(tick, observe()); directed.push(...events.map((event) => ({ tick: event.tick, key: event.key })));
      updating = true; for (const update of updates) update(1 / 60, tick / 60); updating = false;
      expect(directed).toEqual(legacy);
    }
    expect(legacy).toEqual([{ tick: 10, key: 'captain.wake' }, { tick: 200, key: 'captain.dead' }, { tick: 220, key: 'reward.start' }, { tick: 640, key: 'reward.finish' }]);
    expect(finale.captain()?.mem['awake']).toBe(1);
  } finally { scope.dispose(); document.body.replaceChildren(); }
}, 60000);
