import { describe, expect, it } from 'vitest';
import { GroupBrain } from '../../src/engine/ai/GroupBrain';

class FixtureGroup extends GroupBrain<{ id: string; alive: boolean; attacking: boolean }> {
  step(time: number): number { const dt = this.groupDelta(time, 0.1); this.groupDirector(2, actor => actor.attacking); return dt; }
  snapshot(): string { return this.snapshotGroup(actor => actor.id); }
  restore(saved: string): void { this.restoreGroup(saved, actor => actor.id); }
  take(id: string): boolean { const actor = this.members.find(member => member.id === id); if (actor === undefined) throw new Error('Missing actor'); return this.groupDirector(2, member => member.attacking).take(actor); }
}
describe('group continuation', () => {
  it('restores the once-per-instant clock and occupied attack tokens without running a decision', () => {
    const members = [{ id: 'a', alive: true, attacking: true }, { id: 'b', alive: true, attacking: true }, { id: 'c', alive: true, attacking: false }];
    const before = new FixtureGroup(members), after = new FixtureGroup(structuredClone(members));
    expect(before.step(1)).toBe(0.1); after.restore(before.snapshot());
    expect(after.step(1)).toBe(0); expect(after.take('c')).toBe(false);
    expect(after.snapshot()).toBe(before.snapshot());
    const first = after.members[0]; if (first === undefined) throw new Error('Missing actor'); first.attacking = false;
    expect(after.take('c')).toBe(true);
  });
  it('rejects a changed roster or forged token pool atomically', () => {
    const group = new FixtureGroup([{ id: 'a', alive: true, attacking: true }]); group.step(2);
    const before = group.snapshot();
    expect(() => group.restore(JSON.stringify({ members: ['other'], time: 1, directors: [] }))).toThrow();
    expect(() => group.restore(JSON.stringify({ members: ['a'], time: 1, directors: [{ cap: 0, held: ['a'] }] }))).toThrow();
    expect(group.snapshot()).toBe(before);
  });
});
