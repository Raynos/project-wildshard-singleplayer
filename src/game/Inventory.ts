/**
 * Inventory — the pack: what harvesting a carcass leaves you with (venison, hides, tusks, antlers; on Driftwood Isle
 * crab claws and coconuts — the drowned sailor and captain fade, nothing to harvest, E318). Counts
 * only, 12 slots, one slot per item kind; persisted per shard ('ws.inventory.v1'). Weapons and ammo are not
 * here — the menu's Inventory tab reads those live from Weapons.
 *
 * Nalati has no pack at all (E314, Jake's pick C, art/loot/round-3-other-shards/board-2-nalati.jpg): its 12 kinds (wolf
 * pelt / fang, horsehair, balbal shard, grave dust, marmot fur, the 5 elites' trophies, the Golden King's plaque) were
 * never read by anything, so they are gone — an old save's copies are dropped on load (an id not in ITEMS), `slots` is 0
 * there and the Bag shows no PACK tab (src/ui/Menu.ts).
 *
 * Pine Hollow's pack (E314, Jake's pick C, art/loot/round-3-other-shards/) holds only the 7 kinds Mott trades for
 * (PINE_PACK_KINDS): everything else a Pine kill or reward used to hand out (boar / elk meat, elk hide, bear claw,
 * antlers, amber heartwood, the elites' trophies) never enters it, and an old save's copies are dropped on load. With
 * one slot per kept kind the pack can never be full; the unlocks that used to ride in it ('warden-longbow') live in
 * Owned (src/game/loot/Owned.ts) — `had(id)` lets the loadout move an old save's flag across.
 *
 *   inventory.add('venison', 1);   inventory.items → [{ id, count }] in the order first picked up
 *   inventory.harvest('elk', 'bull')   → what this shard's pack takes from that carcass (Pine Hollow: nothing)
 *   inventory.onChange = () => menu.refresh();
 */
import type { IconId } from '../ui/icons';

export type ItemId = 'venison' | 'deer-hide' | 'boar-meat' | 'boar-hide' | 'boar-tusk' | 'antlers' | 'elk-meat' | 'elk-hide' | 'bear-pelt' | 'bear-claw'
  | 'crab-meat' | 'crab-claw' | 'crab-shell' | 'coconut' | 'monkey-fur' | 'silver-fur' | 'doubloon'
  // Pine Hollow's elite + boss trophies (PH-C2 / PH-C3, src/pinehollow/); 'warden-longbow' is the King's drop as a flag
  // until the longbow itself (Nalati's Bow.ts) is ported
  | 'ironhide-tusk' | 'ghost-antler' | 'blackpaw-claw' | 'imperial-crown' | 'amber-heartwood' | 'warden-longbow'
  // Pine Hollow's collectibles and the lodge (PH-C6 / C8, src/pinehollow/quest/): resin is the trader's currency-free swap
  // good, a ribbon is what a lodge contract pays
  | 'amber-resin' | 'lodge-ribbon';

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
  // Pine Hollow's elites and the Antler King
  'ironhide-tusk': { label: "Ironhide's broken tusk", icon: 'tusk' },
  'ghost-antler': { label: 'Pale antler', icon: 'antlers' },
  'blackpaw-claw': { label: "Old Blackpaw's claw", icon: 'claw' },
  'imperial-crown': { label: 'Seven-tine crown', icon: 'antlers' },
  'amber-heartwood': { label: 'Amber heartwood', icon: 'laurel' },
  'warden-longbow': { label: "The Warden's Longbow", icon: 'longbow' },
  'amber-resin': { label: 'Amber resin', icon: 'seaglass' },
  'lodge-ribbon': { label: 'Lodge ribbon', icon: 'laurel' },
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
    // Nalati Grasslands: nothing (E314 C — its pelts, fangs, horsehair, shards, dust and the elites' trophies were never
    // read by anything; its prizes are skins and titles), so no carcass there shows [E] Harvest
    default: return [];
  }
}

export const PACK_SLOTS = 12;
/** Pine Hollow's pack: only what Mott the trader takes (src/pinehollow/quest/trades.ts; E314 pick C) — nothing else drops there */
export const PINE_PACK_KINDS = ['venison', 'deer-hide', 'boar-hide', 'boar-tusk', 'bear-pelt', 'amber-resin', 'lodge-ribbon'] as const satisfies readonly ItemId[];
export type PineItem = (typeof PINE_PACK_KINDS)[number];
/** one slot per kept kind: Pine Hollow's pack can never be full */
export const PINE_PACK_SLOTS = PINE_PACK_KINDS.length;
const PINE_KEEPS: ReadonlySet<ItemId> = new Set<ItemId>(PINE_PACK_KINDS);
export const isPineItem = (id: ItemId): id is PineItem => PINE_KEEPS.has(id);
const isPineChunk = (chunkId: string): boolean => chunkId.endsWith('/pine-hollow');
/** Nalati: no pack (E314 C) — nothing enters it, the Bag has no PACK tab */
const isNalatiChunk = (chunkId: string): boolean => chunkId.endsWith('/nalati-grasslands');
const STORE = 'ws.inventory.v1';

export class Inventory {
  private counts: Partial<Record<ItemId, number>>;
  private order: ItemId[];
  /** kinds an older save held that this shard's pack no longer keeps (read once by the loadout's migration) */
  private legacy = new Set<ItemId>();
  onChange?: () => void;

  constructor(readonly chunkId: string) {
    let saved: { counts?: Partial<Record<ItemId, number>>; order?: ItemId[] } = {};
    try { saved = (JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, typeof saved>)[chunkId] ?? {}; } catch { /* defaults */ }
    this.counts = saved.counts ?? {};
    this.order = [];
    for (const id of saved.order ?? []) {
      if (!(id in ITEMS)) { delete this.counts[id]; continue; } // a kind the game no longer has (Nalati's, E314 C)
      if (this.keeps(id)) this.order.push(id);
      else { if ((this.counts[id] ?? 0) > 0) this.legacy.add(id); delete this.counts[id]; }
    }
  }

  /** does this shard's pack take `id` at all? (Pine Hollow: only PINE_PACK_KINDS; Nalati: nothing) */
  keeps(id: ItemId): boolean { return !isNalatiChunk(this.chunkId) && (!isPineChunk(this.chunkId) || PINE_KEEPS.has(id)); }
  /** what this shard's pack takes from a carcass: harvestOf, less the kinds it does not keep (empty = no [E] Harvest) */
  harvest(kind: string, variant?: string): ItemId[] { return harvestOf(kind, variant).filter((id) => this.keeps(id)); }
  /** did the save this pack loaded hold `id`, a kind the pack no longer keeps? ('warden-longbow' → Owned) */
  had(id: ItemId): boolean { return this.legacy.has(id); }

  private save() {
    try {
      const all = (JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, unknown> | null) ?? {};
      all[this.chunkId] = { counts: this.counts, order: this.order };
      localStorage.setItem(STORE, JSON.stringify(all));
    } catch { /* not persisted this session */ }
  }

  /** false, and nothing added, for a kind this shard does not keep or a new kind with every slot taken */
  add(id: ItemId, n = 1): boolean {
    if (!(id in ITEMS) || !this.keeps(id)) return false;
    if (!this.order.includes(id)) { if (this.order.length >= this.slots) return false; this.order.push(id); }
    this.counts[id] = (this.counts[id] ?? 0) + n;
    this.save(); this.onChange?.();
    return true;
  }
  /** this shard's pack size (0: no pack, no PACK tab — Nalati) */
  get slots(): number { return isNalatiChunk(this.chunkId) ? 0 : isPineChunk(this.chunkId) ? PINE_PACK_SLOTS : PACK_SLOTS; }
  /** how many of `id` the pack holds */
  count(id: ItemId): number { return this.counts[id] ?? 0; }
  /** take `n` of `id` out of the pack (a trade); false, and nothing taken, when there are fewer. At 0 the slot frees up. */
  take(id: ItemId, n = 1): boolean {
    const have = this.counts[id] ?? 0;
    if (n <= 0 || have < n) return n <= 0;
    if (have === n) { delete this.counts[id]; this.order = this.order.filter((o) => o !== id); } else this.counts[id] = have - n;
    this.save(); this.onChange?.();
    return true;
  }
  get items(): { id: ItemId; count: number; label: string; icon: IconId }[] { return this.order.map((id) => ({ id, count: this.counts[id] ?? 0, ...ITEMS[id] })); }
  get total(): number { return this.order.reduce((s, id) => s + (this.counts[id] ?? 0), 0); }
}
