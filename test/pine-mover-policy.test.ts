import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { Flags } from '../src/engine/world/interact/flags';
import { bindQuestPageInteractions } from '../src/game/plugin/ui';
import { parseQuestPageInteractions } from '../src/format/questInteractions';
import { PINE_MILL_DOOR } from '../src/shards/pine-hollow/generators/questConsequences';
import { PINE_CANOE } from '../src/shards/pine-hollow/generators/canoe';

// The gate may refuse a use, but never sets quest flags or advances the door itself.
test('the mill door uses admitted ordered conditions and preserves both refusals and old-save access', () => {
  const flags = new Flags('mill-door-policy', false), events: string[] = [], point = new Vector3(1, 2, 3);
  let uses = 0;
  const door = { prompt: { position: point, label: 'Open door', radius: 2, onInteract: () => { throw new Error('Unbound old hook'); } }, use: () => { uses++; } };
  const sfx = { interact: (name: string, at: Vector3) => { expect(at).toBe(point); events.push(name); } };
  bindQuestPageInteractions(parseQuestPageInteractions(PINE_MILL_DOOR), { flags, toast: text => { events.push(text); },
    owners: new Map<string, unknown>([['door', door], ['sfx', sfx]]) });
  door.prompt.onInteract(); expect(uses).toBe(0);
  expect(events.splice(0)).toEqual(['The mill door is barred from inside', 'locked']);
  flags.set('errand:asked'); door.prompt.onInteract(); expect(uses).toBe(0);
  expect(events.splice(0)).toEqual(['Barred from inside. Brandt keeps the mill shut until the race is clear', 'locked']);
  for (const saved of [['errand:done'], ['errand:asked', 'errand:done']]) {
    flags.restore(saved); const previous = uses; door.prompt.onInteract(); expect(uses).toBe(previous + 1);
    expect(flags.all).toEqual(saved); expect(events).toEqual([]);
  }
});

test('canoe data keeps the original bank minima, live landing samples and surface clock tuning', () => {
  expect(PINE_CANOE).toEqual({ kind: 'transit', from: [-69, -3, 119], to: [-87.6, -3, 118.4],
    landings: [[-67.8 + 2.6, 0, 119 + 1.4], [-89.8, 0, 118.6]], seconds: 9, water: -2.98,
    bankRamp: 8, seat: -0.45, yaw: Math.PI, bob: [1.9, 0.03], pitch: [1.3, 0.02], roll: [2.1, 0.035, 1] });
});
