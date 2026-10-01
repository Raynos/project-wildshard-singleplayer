import { Equipment } from './Equipment';

export type EquipmentAction = 'bolt.cycle' | 'attack' | 'reload' | 'aim' | 'heavy' | 'hover' | 'lock' | 'jump' | 'swap' | 'swap.next' | 'swap.prev' | `swap.slot.${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;
export abstract class Tool extends Equipment {
  abstract readonly slot: 'tool' | 'offhand';
  abstract readonly actions: readonly EquipmentAction[];
}
