import { describe, expect, it } from 'vitest';
import { Scope } from '#engine/app/scope';
import { EncounterRegistry } from '#engine/ai/encounters';

describe('resident encounter metadata', () => {
  it('keeps names and head-bar policy scoped to the active level', () => {
    const root = new Scope('engine'), a = root.child('a'), b = root.child('b');
    let active: Scope | null = a;
    const rows = new EncounterRegistry(() => active);
    rows.register({ id: 'king', displayName: 'King A', showHeadBar: false }, a);
    rows.register({ id: 'king', displayName: 'King B', showHeadBar: true }, b);
    expect(rows.get('king')).toEqual({ id: 'king', displayName: 'King A', showHeadBar: false });
    active = b; expect(rows.get('king')?.displayName).toBe('King B');
    a.dispose(); expect(rows.get('king')?.displayName).toBe('King B');
    b.dispose(); expect(rows.get('king')).toBeUndefined(); active = null; expect(rows.get('king')).toBeUndefined();
  });
  it('registers child scopes and rejects duplicate/disposed registrations', () => {
    const level = new Scope('level'), practice = level.child('practice'), rows = new EncounterRegistry(() => level);
    rows.register({ id: 'dummy', displayName: 'Training dummy', showHeadBar: false }, practice);
    expect(rows.get('dummy')?.displayName).toBe('Training dummy');
    expect(() => rows.register({ id: 'dummy' }, practice)).toThrow('Duplicate');
    practice.dispose(); expect(rows.get('dummy')).toBeUndefined(); expect(() => rows.register({ id: 'dummy' }, practice)).toThrow('disposed');
  });
});
