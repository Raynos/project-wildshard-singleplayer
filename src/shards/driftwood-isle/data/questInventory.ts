import { SEA_GLASS_FLAG, SHARD_FLAGS } from './interactables';
import { QUEST_DONE } from './questStory';

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

/** Native continuation policy: positive safe stacks and complete first-pickup order. */
export const DRIFTWOOD_NATIVE_PACK = { kinds: Object.keys(ITEM_LABELS), slots: 12,
  counts: { min: 1, max: Number.MAX_SAFE_INTEGER, integer: true, complete: true }, quantity: 'positive-safe-integer', snapshot: 'order',
  stackLimit: Number.MAX_SAFE_INTEGER, restoreError: 'Incompatible Driftwood pack continuation' } as const;

/** Page flag totals retain their original submission order. */
export const DRIFTWOOD_FLAG_FEATS=[
  {id:'castaway',method:'count',value:{flag:'talked:castaway'}},
  {id:'shards',method:'count',value:{flags:SHARD_FLAGS}},
  {id:'glass',method:'count',value:{prefix:SEA_GLASS_FLAG}},
  {id:'treasure',method:'count',value:{flag:'open:reef-treasure'}},
  {id:'vista',method:'count',value:{flag:'used:vista-bench'}},
  {id:'zipline',method:'count',value:{flag:'used:zipline'}},
  {id:'quest',method:'count',value:{flag:QUEST_DONE}},
] as const;

/** Page feat counters retain floor totals and update after stable emission. */
export const DRIFTWOOD_FEAT_COUNTERS={feats:DRIFTWOOD_FEATS,flags:DRIFTWOOD_FLAG_FEATS,prefix:'driftwood.',floorTotals:true,validateTotals:true,write:'after'} as const;
