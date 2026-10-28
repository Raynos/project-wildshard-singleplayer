import { expect, test } from 'vitest';
import { parseHeldSlots } from '../src/format/heldArms';
import slots from '../src/shards/nalati-grasslands/boot/mountedLoadout.json' with { type: 'json' };
import { nalatiLateHeldNames } from '../src/shards/nalati-grasslands/generators/modelBindings';

const file = 'weapons/spear.json', pool = 'models/held/spear.glb';
const pools = new Map([[file, pool]]);

function deferredRows(): ReturnType<typeof parseHeldSlots> {
  const rows = parseHeldSlots(slots);
  for (const row of rows.slots) if (row.kind === 'polearm') row.geometry = 'on-select';
  return rows;
}

test('shipping keeps spare geometry eager; an explicit inactive marker hints only its declared pool', () => {
  const shipping = parseHeldSlots(slots);
  expect(shipping.slots.find(row => row.id === 'polearm')).not.toHaveProperty('geometry');
  expect(nalatiLateHeldNames(shipping, pools)).toEqual([]);
  const rows = deferredRows(), before = structuredClone(rows);
  expect(rows.slots.find(row => row.id === 'polearm')).toMatchObject({ file, geometry: 'on-select' });
  expect(nalatiLateHeldNames(rows, pools)).toEqual([pool]);
  expect(nalatiLateHeldNames(rows, new Map())).toEqual([]);
  expect(rows).toStrictEqual(before);
  const eager = structuredClone(rows);
  for (const row of eager.slots) if (row.kind === 'polearm') delete row.geometry;
  expect(nalatiLateHeldNames(eager, pools)).toEqual([]);
  expect(parseHeldSlots(eager).slots.find(row => row.id === 'polearm')).not.toHaveProperty('geometry');
});

test('primary, declared initial and shared eager pool references stay ready', () => {
  const rows = deferredRows();
  expect(nalatiLateHeldNames({ ...rows, equipment: { ...rows.equipment, primary: 'polearm' } }, pools)).toEqual([]);
  expect(nalatiLateHeldNames({ ...rows, selection: { ...rows.selection, initial: 'polearm' } }, pools)).toEqual([]);
  const alias = { id: 'alternate', kind: 'polearm' as const, item: 'weapon.alternate', file: 'weapons/alias.json' };
  const shared = parseHeldSlots({ ...rows, slots: [...rows.slots, alias], registration: [...rows.registration, alias.id],
    equipment: { ...rows.equipment, extras: [...rows.equipment.extras, alias.id] } });
  expect(nalatiLateHeldNames(shared, new Map([...pools, [alias.file, pool]]))).toEqual([]);
});
