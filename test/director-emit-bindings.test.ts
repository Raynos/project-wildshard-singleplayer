import { expect, test, vi } from 'vitest';
import { DirectorScriptStageLane, prepareEmbeddedDirector } from '../src/game/plugin/director';
import declaration from '../src/shards/driftwood-isle/data/director.json';
import module from '../src/shards/driftwood-isle/behaviour/director.json';
import rows from '../src/shards/driftwood-isle/data/finaleStages.json';
import type { DirectorAction } from '../src/format/directorStages';

const observe = (): Record<string, number> => ({ altar: 0, dead: 0, seen: 0, 'player-x': 30, 'player-z': 30, 'reward-x': 0, 'reward-z': 0 });
const keys = ['captain.restore', 'captain.wake', 'captain.dead', 'reward.start', 'reward.finish'];
function actions(seen: string[]): Map<string, (value: number) => void> {
  return new Map(keys.map(key => [key, value => { seen.push(`${key}:${String(value)}`); }]));
}

test('named emits run admitted native events in order and keep continuation restore quiet', async () => {
  const create = await prepareEmbeddedDirector(declaration, module, 357), seen: string[] = [], observation = observe(), callbacks = actions(seen);
  const lane = new DirectorScriptStageLane(rows, create(), { observe: () => observation, emits: { source: 'matching', actions: callbacks } });
  callbacks.clear(); // Admission copies the validated map; later caller edits cannot remove a binding.
  observation['altar'] = 1; lane.changed();
  observation['dead'] = 1; lane.changed();
  expect(seen).toEqual(['captain.wake:0', 'captain.dead:0']);
  const saved = lane.snapshot(); lane.restore(saved); expect(seen).toHaveLength(2);
  observation['player-x'] = 0; observation['player-z'] = 0;
  lane.update(1); expect(seen.at(-1)).toBe('reward.start:0');
  for (let tick = 0; tick < 8; tick++) lane.update(1);
  expect(seen.at(-1)).toBe('reward.finish:0');
});

test('preflights every named action and finite callback roster before author initialization', async () => {
  const create = await prepareEmbeddedDirector(declaration, module, 357), seen: string[] = [], callbacks = actions(seen), script = create();
  callbacks.delete('reward.finish');
  expect(() => new DirectorScriptStageLane(rows, script, { observe, emits: { source: 'optional', actions: callbacks } })).toThrow('Unbound director emit action');
  expect(script.tick).toBe(-1); expect(seen).toEqual([]);
  const initial = rows.stages[0]; if (initial === undefined) throw new Error('Missing initial stage');
  for (const command of [{ emit: 'captain.restore', value: 1 }, { spawn: 'actor' }]) {
    const data = { ...rows, stages: [{ ...initial, do: [command] }, ...rows.stages.slice(1)] };
    expect(() => new DirectorScriptStageLane(data, create(), { observe, emits: { source: 'optional', actions: actions(seen) } })).toThrow('Unbound director emit action');
  }
  const oversized = new Map(Array.from({ length: 65 }, (_, i) => [`action-${String(i)}`, () => undefined]));
  expect(() => new DirectorScriptStageLane(rows, create(), { observe, emits: { source: 'optional', actions: oversized } })).toThrow('Invalid director emit bindings');
});

test('matching sources refuse bootstrap and wrong-key events while optional preserves bootstrap and legacy publication', async () => {
  const create = await prepareEmbeddedDirector(declaration, module, 357), seen: string[] = [], initial = rows.stages[0];
  if (initial === undefined) throw new Error('Missing initial stage');
  const bootstrap = { ...rows, stages: [{ ...initial, do: [{ emit: 'captain.restore', value: 0 }] }, ...rows.stages.slice(1)] };
  expect(() => new DirectorScriptStageLane(bootstrap, create(), { observe, emits: { source: 'matching', actions: actions(seen) } })).toThrow('Invalid director emit source');
  new DirectorScriptStageLane(bootstrap, create(), { observe, emits: { source: 'optional', actions: actions(seen) } });
  expect(seen).toEqual(['captain.restore:0']);
  const script = create();
  vi.spyOn(script, 'step').mockReturnValue([{ director: script.data.id, tick: 0, key: 'captain.wake', type: 'none', value: 0 }]);
  const wrong = structuredClone(rows), awakened = wrong.stages.find(row => row.id === 'awakened');
  if (awakened === undefined) throw new Error('Missing awakened stage');
  awakened.do = [{ emit: 'captain.dead' }];
  expect(() => new DirectorScriptStageLane(wrong, script, { observe, emits: { source: 'matching', actions: actions(seen) } })).toThrow('Invalid director emit source');
  expect(seen).toHaveLength(1);
  const legacy = { observe, publish(action: DirectorAction) { expect(this).toBe(legacy); if ('emit' in action) seen.push(action.emit); } };
  new DirectorScriptStageLane(bootstrap, create(), legacy);
  expect(seen.at(-1)).toBe('captain.restore');
});

test('matching numeric events lend their admitted payload without replacing the row literal', async () => {
  const create = await prepareEmbeddedDirector(declaration, module, 12), script = create(), seen: number[] = [];
  vi.spyOn(script, 'step').mockReturnValue([{ director: script.data.id, tick: 0, key: 'captain.restore', type: 'number', value: 23.5 }]);
  const callbacks = new Map(keys.map(key =>
    [key, (value: number) => { seen.push(value); }]));
  new DirectorScriptStageLane(rows, script, { observe: () => ({}), emits: { source: 'matching', actions: callbacks } });
  expect(seen).toEqual([23.5]);
});
