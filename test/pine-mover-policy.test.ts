import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { Flags } from '../src/engine/world/interact/flags';
import { bindQuestPageInteractions } from '../src/game/plugin/ui';
import { parseQuestPageInteractions } from '../src/format/questInteractions';
import { PINE_MILL_DOOR } from '../src/shards/pine-hollow/generators/questConsequences';
import { canoeMover } from '../src/shards/pine-hollow/generators/canoe';

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

test('canoe uses the existing ride driver with offline bank/landing samples', () => {
  const row = canoeMover(() => 2);
  expect(row.driver).toEqual({ kind: 'winch', mode: 'ride', dwell: 1, gate: false, return: 'command', ease: 'smoothstep', snap: 0 });
  expect(row.track?.position).toEqual([[-69, 2, 119], [-87.6, 2, 118.4]]);
  expect(row.carry?.landings).toEqual([[-67.8 + 2.6, 2, 119 + 1.4], [-89.8, 2, 118.6]]);
  expect(row.carry?.surface).toEqual({ level: -2.98, bankRamp: 8, bob: [1.9, 0.03], pitch: [1.3, 0.02], roll: [2.1, 0.035, 1] });
  expect(row.kind).toBe('channel'); expect(row.execution).toBe('native'); expect(row.boxes).toEqual([]);
});
