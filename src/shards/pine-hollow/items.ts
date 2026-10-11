import type { ItemId } from '@wildshard/game/Inventory';
import { PINE_PACK_KINDS, type PineItem } from './data/questInventory';

const PINE_KEEPS: ReadonlySet<ItemId> = new Set<ItemId>(PINE_PACK_KINDS);
export const isPineItem = (id: ItemId): id is PineItem => PINE_KEEPS.has(id);
