import { app, Scope, WeightedTable } from '@wildshard/engine';
import { describe, expect, it, vi } from 'vitest';
import { NIGHT_SPAWNS, nightSpawner } from '../../src/shards/nalati-grasslands/combat/spawns';
import { NALATI_DEFINITIONS, NALATI_SPECIES, NALATI_LOOKS } from '../../src/shards/nalati-grasslands/species/rows';
import { manager } from '../fake/manager';

describe('Nalati scoped encounter catalogs', () => {
  it('publishes gameplay rows apart from geometry and all custom cadence policies', () => {
    expect(NALATI_SPECIES.map(row => row.kind)).toEqual(NALATI_DEFINITIONS.map(def => def.kind));
    for (const row of NALATI_SPECIES) {
      expect(row).not.toHaveProperty('build'); expect(row).not.toHaveProperty('fur');
      expect(row.tick).toBe(row.kind === 'golden-king' ? 'always' : 'ai');
    }
    for (const look of NALATI_LOOKS) {
      expect(typeof look.material).toBe('function'); expect(typeof look.skin).toBe('function');
    }
  });
  it.each(NIGHT_SPAWNS)('$id filters the phase and variant without another random draw', row => {
    const table = new WeightedTable(row.table), next = vi.fn(() => 0.5);
    const variant = row.table.rows[0]?.item.variant;
    if (variant === undefined) throw new Error('Night rows require an explicit variant');
    expect(table.roll({ tags: ['day', variant] }, next)).toEqual([]);
    expect(table.roll({ tags: ['night', variant] }, next)).toEqual([{ item: row.table.rows[0]?.item, count: 1 }]);
    expect(table.roll({ tags: ['force', variant] }, next)).toHaveLength(1);
    expect(next).not.toHaveBeenCalled();
  });
  it('retires night bodies and scheduler registrations with the resident scope', () => {
    const scope = new Scope('night-fixture'), f = manager(), next = vi.fn(() => 0.5);
    const spawner = nightSpawner('spawn.nalati.balbals', scope, f.manager);
    const actor = spawner.spawn({ tags: ['night', 'warrior'] }, { x: 0, z: 0, yaw: 0 }, next)[0];
    if (actor === undefined) throw new Error('Expected one balbal');
    expect(f.manager.animals).toContain(actor); scope.dispose();
    expect(f.manager.animals).not.toContain(actor); expect(actor.alive).toBe(false);
    expect(app.encounters.runtime('night-fixture')).toBeUndefined(); expect(next).not.toHaveBeenCalled();
    expect(() => spawner.spawn({ tags: ['night', 'warrior'] }, { x: 0, z: 0, yaw: 0 }, next)).toThrow('disposed');
  });
});
