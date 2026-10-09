import { expect, it } from 'vitest';
import { Flags } from '../../../src/engine/world/interact/flags';
import { PinePeople } from '../../../src/shards/pine-hollow/runtime/people';

const at = { x: 8, y: 3, z: 4 }, feet = { ...at, y: at.y - 1.68 };
const spots = (['ranger', 'miller', 'trader'] as const).map(kind => ({ kind, at, prompt: { ...at, radius: 3.2 } }));
function setup() { const flags = new Flags('pine-people', false), paid: string[] = [];
  return { flags, paid, people: new PinePeople(flags, spots, kind => { paid.push(kind); }) };
}
function finish(people: PinePeople): void {
  for (let i = 0; i < 32 && people.active; i++) { people.advanceReading(1 / 60, feet); people.press('ranger'); }
  expect(people.active).toBe(false);
}
it('commits only the chosen speaker, keeps modal use on that speaker, and restores mid-line silently', () => {
  const { people, flags, paid } = setup(), resumed = setup();
  people.press('miller'); people.advanceReading(0.03, feet); const saved = people.snapshot();
  resumed.people.prepareRestore(saved)(); expect(resumed.paid).toEqual([]); expect(resumed.flags.all).toEqual([]);
  finish(people); finish(resumed.people);
  expect(flags.all).toEqual(['errand:asked']); expect(resumed.flags.all).toEqual(flags.all);
  expect(paid).toEqual(['miller']); expect(resumed.paid).toEqual(paid);
  flags.set('errand:done'); people.press('miller'); finish(people);
  expect(flags.has('errand:thanked')).toBe(true); expect(paid).toEqual(['miller', 'miller']);
  people.press('trader'); finish(people); expect(flags.has('talked:trader')).toBe(true);
});
it('cancellation, walk-off and incompatible restoration never invoke completion', () => {
  const { people, paid, flags } = setup();
  people.press('miller'); people.dismiss(); expect(paid).toEqual([]);
  people.press('trader'); people.advanceReading(0.1, { ...feet, x: feet.x + 9 }); expect(people.active).toBe(false); expect(paid).toEqual([]);
  people.press('miller'); const before = people.snapshot();
  for (const value of [{ kind: 'foreign', reading: before }, { kind: 'trader', reading: null },
    { kind: 'trader', reading: 'bad' }, { kind: 'trader', reading: before }]) {
    expect(() => people.prepareRestore(value)).toThrow(); expect(people.snapshot()).toEqual(before); expect(paid).toEqual([]);
  }
  expect(flags.all).toEqual([]);
});
