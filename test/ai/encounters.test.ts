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
  it('owns spawn actors and encounter brains through switching and unload without extra draws', () => {
    const root = new Scope('engine'), a = root.child('a'), b = root.child('b');
    let active: Scope | null = a;
    const service = new EncounterRegistry(() => active), retired: string[] = [], disposed: string[] = [];
    service.registerSpawn({ id: 'night', table: { mode: 'each', rows: [
      { item: { kind: 'elk', variant: 'thrall' }, weight: 1, when: (ctx) => ctx.kind === 'elk' },
      { item: { kind: 'boar', variant: 'thrall' }, weight: 1, when: (ctx) => ctx.kind === 'boar' },
    ] } }, a);
    let draws = 0;
    const spawner = service.spawn('night', a, { create: (entry, point) => `${entry.kind}:${point.x}`, retire: (actor) => { retired.push(actor); } });
    const spawn = (kind: string) => spawner.spawn({ kind, tags: ['night'] }, { x: 12, z: 4, yaw: 0 }, () => { draws++; return 0.2; });
    expect(spawn('elk')).toEqual(['elk:12']); expect(spawn('boar')).toEqual(['boar:12']); expect(draws).toBe(0);
    service.boss('king', { disarm: () => { disposed.push('king'); } }, a);
    service.elite('elite', { despawn: () => { disposed.push('elite'); } }, a);
    expect(service.runtime('king')).toBeDefined(); active = b; expect(service.runtime('king')).toBeUndefined();
    spawner.retire('elk:12'); spawner.retire('elk:12'); expect(retired).toEqual(['elk:12']);
    a.dispose(); expect(retired).toEqual(['elk:12', 'boar:12']); expect(disposed).toEqual(['elite', 'king']);
    expect(() => spawn('elk')).toThrow('disposed');
    expect(() => service.spawn('night', b, { create: () => '', retire: () => undefined })).toThrow('Unknown');
    active = null; b.dispose(); root.dispose();
  });
});
