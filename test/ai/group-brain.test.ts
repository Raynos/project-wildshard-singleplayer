import { describe, expect, it } from 'vitest';
import { GroupBrain } from '#engine-internal/ai/GroupBrain';

class Group extends GroupBrain<{ alive: boolean }> {
  step(t: number, dt: number): number { return this.groupDelta(t, dt); }
  attacks(cap: number, attacking: (a: { alive: boolean }) => boolean) { return this.groupDirector(cap, attacking); }
}
describe('shared group blackboard and dynamic attack director', () => {
  it('counts one decision per simulation instant without throttling the near 20Hz clock', () => {
    const group = new Group([{ alive: true }, { alive: true }]);
    expect(group.step(0.05, 0.05)).toBe(0.05); expect(group.step(0.05, 0.05)).toBe(0);
    expect(group.step(0.1, 0.05)).toBe(0.05); group.blackboard.set('awareness', 0.8);
    expect(group.blackboard.get('awareness')).toBe(0.8);
  });
  it('keeps existing attacks and releases dead/finished holders when the mounted cap changes', () => {
    const first = { alive: true }, second = { alive: true }, third = { alive: true }, group = new Group([first, second, third]);
    const attacking = new Set([first]);
    const foot = group.attacks(1, (a) => attacking.has(a)); expect(foot.take(second)).toBe(false);
    const mounted = group.attacks(2, (a) => attacking.has(a)); expect(mounted.holds(first)).toBe(true); expect(mounted.take(second)).toBe(true); expect(mounted.take(third)).toBe(false);
    attacking.clear(); expect(group.attacks(1, (a) => attacking.has(a)).take(third)).toBe(true);
  });
});
