import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { Flags } from '../src/engine/world/interact/flags';
import { DirectorScriptStageLane, prepareEmbeddedDirector } from '../src/game/plugin/director';
import declaration from '../src/shards/driftwood-isle/data/director.json';
import module from '../src/shards/driftwood-isle/behaviour/director.json';
import stages from '../src/shards/driftwood-isle/data/finaleStages.json';
import bindings from './fixtures/driftwood-director-bindings.json' with { type: 'json' };

function createDriftwoodFinale(scope: Scope, lane: ConstructorParameters<typeof DirectorScriptStageLane>[1], ports: {
  flags: Flags; player: Vector3; rewardAt: Vector3; reward: { started: boolean; completed: boolean };
  captain: ReadonlyMap<string, (value: number) => void>;
}, restoring = false): DirectorScriptStageLane {
  const { flags, player, rewardAt, reward } = ports;
  return DirectorScriptStageLane.bind(stages, lane, bindings, new Map<string, unknown>([
    ['flags', flags], ['player', player], ['rewardAt', rewardAt], ['reward', reward],
    ['captain', Object.fromEntries([...ports.captain].map(([key, run]) => [key.slice('captain.'.length), run]))],
  ]), scope, restoring);
}

test('page and native finale edges share their ordering and resume the old stage envelope quietly', async () => {
  const create = await prepareEmbeddedDirector(declaration, module, 357), scope = new Scope('finale-controller'), flags = new Flags('finale-controller', false);
  const seen: string[] = [], player = new Vector3(30, 0, 30), rewardAt = new Vector3(), reward = { started: false, completed: false };
  const captain = new Map(['captain.restore', 'captain.wake', 'captain.dead'].map(key => [key, () => { seen.push(key); }]));
  try {
    const clock = createDriftwoodFinale(scope, create(), { flags, player, rewardAt, reward, captain });
    flags.set('used:altar'); flags.set('dead:captain');
    expect(seen).toEqual(['captain.wake', 'captain.dead']);
    clock.update(1); expect(reward.started).toBe(false);
    player.set(0, 0, 0); clock.update(1); expect(reward.started).toBe(true);
    for (let i = 0; i < 8; i++) clock.update(1);
    expect(reward.completed).toBe(true); expect(flags.has('seen:reward')).toBe(true);
    scope.dispose(); flags.clear('used:altar'); flags.set('used:altar'); expect(seen).toHaveLength(2);
  } finally { scope.dispose(); }

  const restoredScope = new Scope('restored-finale'), restoredFlags = new Flags('restored-finale', false), effects: string[] = [];
  restoredFlags.set('used:altar'); restoredFlags.set('dead:captain');
  const old = new DirectorScriptStageLane(stages, create(), {
    observe: () => ({ altar: 1, dead: 1, seen: 0, 'player-x': 0, 'player-z': 0, 'reward-x': 0, 'reward-z': 0 }),
    publish: action => { if ('emit' in action) effects.push(action.emit); },
  });
  old.update(1); const saved = old.snapshot(); effects.length = 0;
  const resumedReward = { started: false, completed: false };
  try {
    const resumed = createDriftwoodFinale(restoredScope, create(), { flags: restoredFlags, player: new Vector3(), rewardAt: new Vector3(), reward: resumedReward,
      captain: new Map(['captain.restore', 'captain.wake', 'captain.dead'].map(key => [key, () => { effects.push(key); }])) }, true);
    resumed.restore(saved); expect(effects).toEqual([]);
    for (let i = 0; i < 8; i++) resumed.update(1);
    expect(resumedReward.completed).toBe(true); expect(restoredFlags.has('seen:reward')).toBe(true); expect(effects).toEqual([]);
  } finally { restoredScope.dispose(); }
});
