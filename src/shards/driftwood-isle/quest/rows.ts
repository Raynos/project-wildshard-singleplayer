import type { AchievementDef } from '@wildshard/game/achievements';
import type { ItemRow } from '@wildshard/game/bag/items';
import type { ItemId } from '@wildshard/game/Inventory';
import type { IconId } from '@wildshard/engine/ui/icons';

export const DRIFTWOOD_FEATS: AchievementDef[] = [
  { id: 'castaway', name: 'Message in a Bottle', goal: 'Talk to the castaway', count: 1, event: 'talked', title: 'Honorary Castaway', icon: 'rope' },
  { id: 'shards', name: 'Shardkeeper', goal: 'Find the 3 glyph shards', count: 3, event: 'shard', title: 'Keeper of the Ring', icon: 'poi' },
  { id: 'quest', name: 'The Sealed Ring', goal: 'Open the Ring Shrine', count: 1, event: 'quest', title: 'Ringbearer', icon: 'laurel' },
  { id: 'glass', name: 'Beachcomber', goal: 'Find all 15 sea glass', count: 15, event: 'glass', title: 'Sea Glass Hoarder', icon: 'seaglass' },
  { id: 'treasure', name: 'Pearl Diver', goal: 'Dive for the treasure', count: 1, event: 'treasure', title: 'Held Breath Champion', icon: 'coin' },
  { id: 'vista', name: 'Take a Seat', goal: 'Sit on the vista bench', count: 1, event: 'vista', title: 'Professional Sitter', icon: 'check' },
  { id: 'zipline', name: 'Zip It', goal: 'Ride the zipline down', count: 1, event: 'zipline', title: 'Line Rider', icon: 'rope' },
  { id: 'sailor', name: 'Shore Leave', goal: 'Beat the drowned sailor', count: 1, kind: 'sailor', title: 'Deckhand\'s Nightmare', icon: 'sword' },
  { id: 'crab10', name: 'Crab Rave', goal: 'Kill 10 reef crabs', count: 10, kind: 'crab', title: 'Crabby', icon: 'claw' },
  { id: 'monkey6', name: 'Barrel of Monkeys', goal: 'Kill 6 coconut monkeys', count: 6, kind: 'monkey', title: 'Monkey Business', icon: 'coconut' },
];


const ITEM_LABELS: Partial<Record<ItemId, { label: string; icon: IconId }>> = {
  'crab-meat': { label: 'Crab meat', icon: 'meat' },
  'crab-claw': { label: 'Crab claw', icon: 'claw' },
  'crab-shell': { label: 'Reef shell', icon: 'shell' },
  'coconut': { label: 'Coconut', icon: 'coconut' },
  'monkey-fur': { label: 'Monkey fur', icon: 'hide' },
  'silver-fur': { label: 'Silver fur', icon: 'hide' },
  'doubloon': { label: 'Salt-crusted doubloon', icon: 'coin' },
};

export const DRIFTWOOD_ITEMS: readonly ItemRow[] = Object.entries(ITEM_LABELS).map(([id, row]) => ({ id, label: row.label, icon: row.icon, travels: false }));
