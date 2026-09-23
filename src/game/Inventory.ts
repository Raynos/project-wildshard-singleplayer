/**
 * Inventory — the pack: what harvesting a carcass leaves you with (venison, hides, tusks, antlers; on Driftwood Isle
 * crab claws, coconuts and the drowned sailor's doubloon). Counts
 * only, 12 slots, one slot per item kind; persisted per shard ('ws.inventory.v1'). Weapons and ammo are not
 * here — the menu's Inventory tab reads those live from Weapons.
 *
 *   inventory.add('venison', 1);   inventory.items → [{ id, count }] in the order first picked up
 *   inventory.onChange = () => menu.refresh();
 */
import type { IconId } from '../ui/icons';

export type ItemId = 'venison' | 'deer-hide' | 'boar-meat' | 'boar-hide' | 'boar-tusk' | 'antlers' | 'elk-meat' | 'elk-hide' | 'bear-pelt' | 'bear-claw'
  | 'crab-meat' | 'crab-claw' | 'crab-shell' | 'coconut' | 'monkey-fur' | 'silver-fur' | 'doubloon' | 'sea-glass' | 'old-rope'
  | 'gold-plaque' | 'leopard-pelt' | 'grey-mother-pelt' | 'eagle-feather' | 'captain-standard' | 'mane-braid';

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
  // Driftwood Isle
  'crab-meat': { label: 'Crab meat', icon: 'meat' },
  'crab-claw': { label: 'Crab claw', icon: 'claw' },
  'crab-shell': { label: 'Reef shell', icon: 'shell' },
  'coconut': { label: 'Coconut', icon: 'coconut' },
  'monkey-fur': { label: 'Monkey fur', icon: 'hide' },
  'silver-fur': { label: 'Silver fur', icon: 'hide' },
  'doubloon': { label: 'Salt-crusted doubloon', icon: 'coin' },
  'sea-glass': { label: 'Sea glass', icon: 'seaglass' },
  'old-rope': { label: 'Old rope', icon: 'rope' },
  // Nalati Grasslands — boss trophies (src/nalati/kurganBoss.ts)
  'gold-plaque': { label: "Golden King's plaque", icon: 'coin' },
  // Nalati — named-elite trophies (src/nalati/elites.ts)
  'leopard-pelt': { label: 'Snow-leopard pelt', icon: 'hide' },
  'grey-mother-pelt': { label: "The grey mother's pelt", icon: 'hide' },
  'eagle-feather': { label: 'Golden eagle feather', icon: 'rope' },
  'captain-standard': { label: "The captain's standard", icon: 'ghost' },
  'mane-braid': { label: 'Black mane braid', icon: 'rope' },
};

/** what a carcass of (kind, variant) yields when harvested */
export function harvestOf(kind: string, variant?: string): ItemId[] {
  switch (kind) {
    case 'deer': return /stag|ghost/.test(variant ?? '') ? ['venison', 'deer-hide', 'antlers'] : ['venison', 'deer-hide'];
    case 'boar': return variant === 'sow' ? ['boar-meat', 'boar-hide'] : ['boar-meat', 'boar-hide', 'boar-tusk'];
    case 'elk': return /bull|imperial/.test(variant ?? '') ? ['elk-meat', 'elk-hide', 'antlers'] : ['elk-meat', 'elk-hide']; // cows carry no rack
    case 'bear': return ['bear-pelt', 'bear-claw'];
    case 'crab': return variant === 'big' ? ['crab-meat', 'crab-claw', 'crab-shell'] : ['crab-meat', 'crab-claw']; // only the big one's shell is worth keeping
    case 'monkey': return variant === 'elder' ? ['coconut', 'silver-fur'] : ['coconut', 'monkey-fur']; // every monkey was carrying one
    case 'sailor': return ['doubloon', 'sea-glass', 'old-rope']; // the drowned sailor's pockets
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
      const all = (JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, unknown> | null) ?? {};
      all[this.chunkId] = { counts: this.counts, order: this.order };
      localStorage.setItem(STORE, JSON.stringify(all));
    } catch { /* not persisted this session */ }
  }

  add(id: ItemId, n = 1): void {
    if (!(id in ITEMS)) return;
    if (!this.order.includes(id)) { if (this.order.length >= PACK_SLOTS) return; this.order.push(id); }
    this.counts[id] = (this.counts[id] ?? 0) + n;
    this.save(); this.onChange?.();
  }
  get items(): { id: ItemId; count: number; label: string; icon: IconId }[] { return this.order.map((id) => ({ id, count: this.counts[id] ?? 0, ...ITEMS[id] })); }
  get total(): number { return this.order.reduce((s, id) => s + (this.counts[id] ?? 0), 0); }
}
