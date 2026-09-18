/**
 * Inventory — the pack: what harvesting a carcass leaves you with (venison, hides, tusks, antlers). Counts
 * only, 12 slots, one slot per item kind; persisted per shard ('ws.inventory.v1'). Weapons and ammo are not
 * here — the menu's Inventory tab reads those live from Weapons.
 *
 *   inventory.add('venison', 1);   inventory.items → [{ id, count }] in the order first picked up
 *   inventory.onChange = () => menu.refresh();
 */
import type { IconId } from '../ui/icons';

export type ItemId = 'venison' | 'deer-hide' | 'boar-meat' | 'boar-hide' | 'boar-tusk' | 'antlers' | 'elk-meat' | 'elk-hide' | 'bear-pelt' | 'bear-claw';

export const ITEMS: Record<ItemId, { label: string; icon: IconId }> = {
  'venison': { label: 'Venison', icon: 'meat' },
  'deer-hide': { label: 'Deer hide', icon: 'hide' },
  'boar-meat': { label: 'Boar meat', icon: 'meat' },
  'boar-hide': { label: 'Boar hide', icon: 'hide' },
  'boar-tusk': { label: 'Boar tusk', icon: 'tusk' },
  'antlers': { label: 'Antlers', icon: 'antlers' },
  'elk-meat': { label: 'Elk meat', icon: 'meat' },
  'elk-hide': { label: 'Elk hide', icon: 'hide' },
  'bear-pelt': { label: 'Bear pelt', icon: 'hide' },
  'bear-claw': { label: 'Bear claw', icon: 'tusk' },
};

/** what a carcass of (kind, variant) yields when harvested */
export function harvestOf(kind: string, variant?: string): ItemId[] {
  switch (kind) {
    case 'deer': return /stag|ghost/.test(variant ?? '') ? ['venison', 'deer-hide', 'antlers'] : ['venison', 'deer-hide'];
    case 'boar': return variant === 'sow' ? ['boar-meat', 'boar-hide'] : ['boar-meat', 'boar-hide', 'boar-tusk'];
    case 'elk': return ['elk-meat', 'elk-hide', 'antlers'];
    case 'bear': return ['bear-pelt', 'bear-claw'];
    default: return [];
  }
}

export const PACK_SLOTS = 12;
const STORE = 'ws.inventory.v1';

export class Inventory {
  private counts: Partial<Record<ItemId, number>>;
  private order: ItemId[];
  onChange?: () => void;

  constructor(readonly chunkId: string) {
    let saved: { counts?: Partial<Record<ItemId, number>>; order?: ItemId[] } = {};
    try { saved = (JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, typeof saved>)[chunkId] ?? {}; } catch { /* defaults */ }
    this.counts = saved.counts ?? {};
    this.order = (saved.order ?? []).filter((id) => id in ITEMS);
  }

  private save() {
    try {
      const all = (JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, unknown>) ?? {};
      all[this.chunkId] = { counts: this.counts, order: this.order };
      localStorage.setItem(STORE, JSON.stringify(all));
    } catch { /* not persisted this session */ }
  }

  add(id: ItemId, n = 1) {
    if (!(id in ITEMS)) return;
    if (!this.order.includes(id)) { if (this.order.length >= PACK_SLOTS) return; this.order.push(id); }
    this.counts[id] = (this.counts[id] ?? 0) + n;
    this.save(); this.onChange?.();
  }
  get items() { return this.order.map((id) => ({ id, count: this.counts[id] ?? 0, ...ITEMS[id] })); }
  get total() { return this.order.reduce((s, id) => s + (this.counts[id] ?? 0), 0); }
}
