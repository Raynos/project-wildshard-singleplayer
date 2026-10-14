import { expect, test } from 'vitest';
import { autoFlag, bindInteractPlacements, readInteractPlacements, type InteractTable } from '../src/engine/world/interact/types';
import { bindInteractionState, Flags } from '../src/engine/world/interact/flags';
import { pineTableFromPlacements } from '../src/shards/pine-hollow/quest/table';
import pine from '../src/shards/pine-hollow/data/spots.generated.json' with { type: 'json' };
import driftwood from '../src/shards/driftwood-isle/data/spots.generated.json' with { type: 'json' };
import { DRIFTWOOD_INTERACT } from '../src/shards/driftwood-isle/data/interactables';

test('authored rest sites preserve quest laws and order; malformed or foreign sites refuse before building', () => {
  const table: InteractTable = { external: ['met'], rows: [
    { kind: 'lever', id: 'handle', label: 'Pull', at: { poi: 'world', x: 1, z: 2 }, requires: { all: ['met'] }, latch: true },
    { kind: 'door', id: 'gate', look: 'sluice', w: 2, h: 2, at: { poi: 'world', x: 2, z: 3 }, opensWhen: { all: ['lever:handle'] } },
  ] };
  const placements = [{ id: 'gate', kind: 'door', x: 20, y: 4, z: 30, yaw: 1 }, { id: 'handle', kind: 'lever', x: 10, y: 3, z: 20, yaw: 0 }];
  const bound = bindInteractPlacements(table, placements), flags = new Flags('rest-sites', false);
  expect(bound.rows.map(row => row.id)).toEqual(table.rows.map(row => row.id));
  const handle = bound.rows.find(row => row.id === 'handle'); if (handle?.kind !== 'lever') throw new Error('Missing handle');
  expect(handle.label).toBe('Pull'); expect(handle.at).toMatchObject({ poi: 'world', x: 10, y: 3, z: 20 });
  const state = bindInteractionState(handle, flags); expect(state.locked()).not.toBeNull(); flags.set('met'); expect(state.locked()).toBeNull();
  expect(autoFlag(handle)).toBe('lever:handle'); expect(table.rows[0]?.at).toEqual({ poi: 'world', x: 1, z: 2 });
  expect(() => bindInteractPlacements(table, placements.slice(0, 1))).toThrow();
  expect(() => bindInteractPlacements(table, [...placements, placements[0]])).toThrow();
  expect(() => bindInteractPlacements(table, [{ ...placements[0], id: 'foreign' }, placements[1]])).toThrow();
  expect(() => bindInteractPlacements(table, [{ ...placements[0], kind: 'key' }, placements[1]])).toThrow();
  expect(() => readInteractPlacements([{ id: 'bad', kind: 'lever', x: Infinity, y: 0, z: 0, yaw: 0 }])).toThrow();
  expect(() => readInteractPlacements({})).toThrow();

  const grove = pineTableFromPlacements(pine.rows), island = bindInteractPlacements(DRIFTWOOD_INTERACT, driftwood.rows);
  expect(grove.rows.some(row => row.id === 'dam-sluice' && row.kind === 'door' && row.opensWhen?.all?.includes('lever:dam-log-b'))).toBe(true);
  expect(grove.rows.some(row => row.id.startsWith('resin-') && row.kind === 'pickup' && row.touch === true && row.item === 'amber-resin')).toBe(true);
  expect(island.rows.map(row => row.id)).toEqual(DRIFTWOOD_INTERACT.rows.map(row => row.id));
  expect(island.rows.find(row => row.id === 'hold-key')?.showWhen?.all).toContain('dead:sailor');
  expect(island.rows.find(row => row.id === 'castaway-chest')?.requires?.all).toContain('talked:castaway');
});
