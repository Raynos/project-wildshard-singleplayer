/** Existing achievement metadata; the declared ledger remains its authoritative gameplay projection. */
export const DRIFTWOOD_FEATS = [
  { id: 'castaway', name: 'Message in a Bottle', goal: 'Talk to the castaway', count: 1, event: 'talked', title: 'Honorary Castaway', icon: 'rope' as const },
  { id: 'shards', name: 'Shardkeeper', goal: 'Find the 3 glyph shards', count: 3, event: 'shard', title: 'Keeper of the Ring', icon: 'poi' as const },
  { id: 'quest', name: 'The Sealed Ring', goal: 'Open the Ring Shrine', count: 1, event: 'quest', title: 'Ringbearer', icon: 'laurel' as const },
  { id: 'glass', name: 'Beachcomber', goal: 'Find all 15 sea glass', count: 15, event: 'glass', title: 'Sea Glass Hoarder', icon: 'seaglass' as const },
  { id: 'treasure', name: 'Pearl Diver', goal: 'Dive for the treasure', count: 1, event: 'treasure', title: 'Held Breath Champion', icon: 'coin' as const },
  { id: 'vista', name: 'Take a Seat', goal: 'Sit on the vista bench', count: 1, event: 'vista', title: 'Professional Sitter', icon: 'check' as const },
  { id: 'zipline', name: 'Zip It', goal: 'Ride the zipline down', count: 1, event: 'zipline', title: 'Line Rider', icon: 'rope' as const },
  { id: 'sailor', name: 'Shore Leave', goal: 'Beat the drowned sailor', count: 1, kind: 'sailor', title: 'Deckhand\'s Nightmare', icon: 'sword' as const },
  { id: 'crab10', name: 'Crab Rave', goal: 'Kill 10 reef crabs', count: 10, kind: 'crab', title: 'Crabby', icon: 'claw' as const },
  { id: 'monkey6', name: 'Barrel of Monkeys', goal: 'Kill 6 coconut monkeys', count: 6, kind: 'monkey', title: 'Monkey Business', icon: 'coconut' as const },
];


const ITEM_LABELS = {
  'crab-meat': { label: 'Crab meat', icon: 'meat' as const },
  'crab-claw': { label: 'Crab claw', icon: 'claw' as const },
  'crab-shell': { label: 'Reef shell', icon: 'shell' as const },
  'coconut': { label: 'Coconut', icon: 'coconut' as const },
  'monkey-fur': { label: 'Monkey fur', icon: 'hide' as const },
  'silver-fur': { label: 'Silver fur', icon: 'hide' as const },
  'doubloon': { label: 'Salt-crusted doubloon', icon: 'coin' as const },
};

/** Existing local bag kinds, registered by both page and trusted native inventory owners. */
export const DRIFTWOOD_ITEMS = Object.entries(ITEM_LABELS).map(([id, row]) => ({ id, label: row.label, icon: row.icon, travels: false }));
