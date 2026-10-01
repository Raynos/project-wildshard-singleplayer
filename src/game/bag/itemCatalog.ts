import type { ItemId } from '../Inventory';
import type { ItemRow } from './items';
import type { IconId } from '#engine';

const ITEM_LABELS: Partial<Record<ItemId, { label: string; icon: IconId }>> = {
  'crab-meat': { label: 'Crab meat', icon: 'meat' },
  'crab-claw': { label: 'Crab claw', icon: 'claw' },
  'crab-shell': { label: 'Reef shell', icon: 'shell' },
  'coconut': { label: 'Coconut', icon: 'coconut' },
  'monkey-fur': { label: 'Monkey fur', icon: 'hide' },
  'silver-fur': { label: 'Silver fur', icon: 'hide' },
  'doubloon': { label: 'Salt-crusted doubloon', icon: 'coin' },
};

/** All shipped items stay local to their shard (E357 X9 / decision 75). */
export const ITEMS = Object.fromEntries(Object.entries(ITEM_LABELS).map(([id, row]) => [id, { ...row, travels: false }])) as Record<ItemId, { label: string; icon: IconId; travels: boolean }>;
export function isItemId(id: string): id is ItemId { return Object.hasOwn(ITEMS, id); }

/** A catalog entry follows the row's level scope; starter registrations may be replaced by a level. */
export function registerItemRow(row: ItemRow): () => void {
  if (row.label === undefined || row.icon === undefined) return () => undefined;
  const id = row.id as ItemId;
  const had = Object.hasOwn(ITEMS, id);
  const previous = ITEMS[id];
  const value = { label: row.label, icon: row.icon, travels: row.travels ?? false };
  ITEMS[id] = value;
  return () => { if (ITEMS[id] === value) { if (had) ITEMS[id] = previous; else Reflect.deleteProperty(ITEMS, id); } };
}

