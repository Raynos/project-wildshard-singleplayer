import { LANTERN_FLAGS, QUEST_DONE } from './wardensHollow';
import { RESIN_FLAG, TOKEN_FLAG, SECRET_FLAGS } from './interactions';

/** Authored feat metadata; the declared ledger owns deduplicated gameplay grants. */
export const PINE_FEATS = [
  { id: 'deer5', name: 'Deerstalker', goal: 'Kill 5 deer', count: 5, kind: 'deer', title: 'Antler Management', icon: 'deer' as const },
  { id: 'boar5', name: 'Hog Wild', goal: 'Kill 5 boar', count: 5, kind: 'boar', title: 'Bacon Procurement Officer', icon: 'boar' as const },
  { id: 'elk3', name: 'Big Game', goal: 'Kill 3 elk', count: 3, kind: 'elk', title: 'Elk Yeah', icon: 'elk' as const },
  { id: 'bear2', name: 'Apex', goal: 'Kill 2 bear', count: 2, kind: 'bear', title: 'Unbearable', icon: 'bear' as const },
  { id: 'ghost', name: 'Ghost Story', goal: 'Kill the Ghost stag', count: 1, kind: 'deer', variant: 'ghost', title: 'Ghostbuster', icon: 'ghost' as const },
  { id: 'ironhide', name: 'Old Ironhide', goal: 'Kill Old Ironhide', count: 1, kind: 'boar', variant: 'ironhide', title: "Ironhide's Retirement Plan", icon: 'ironhide' as const },
  // PH-C10 (the remaster): the other two elites, the King, the lantern quest, the collectibles, the lodge, the night
  { id: 'blackpaw', name: 'Eviction Notice', goal: 'Kill Old Blackpaw', count: 1, kind: 'bear', variant: 'black-old', title: 'Landlord of the Den', icon: 'claw' as const },
  { id: 'imperial', name: 'Seven by Seven', goal: 'Kill the Imperial Bull', count: 1, kind: 'elk', variant: 'imperial', title: 'Crown Jeweller', icon: 'antlers' as const },
  { id: 'king', name: 'The Last Light', goal: 'Defeat the Antler King', count: 1, event: 'king', title: 'Regicide, Rustic', icon: 'antlers' as const },
  { id: 'lanterns', name: 'Lamplighter', goal: 'Relight the three waystone lanterns', count: 3, event: 'lantern', title: 'Wick Whisperer', icon: 'poi' as const },
  { id: 'quest', name: "The Warden's Hollow", goal: 'See the dawn over the Hollow', count: 1, event: 'quest', title: 'Morning Person, Finally', icon: 'laurel' as const },
  { id: 'zipline', name: 'Lookout Below', goal: 'Ride the zipline off the fire lookout', count: 1, event: 'zipline', title: "Gravity's Favourite", icon: 'rope' as const },
  { id: 'resin', name: 'Sap Happens', goal: 'Collect all 30 amber resin drops', count: 30, event: 'resin', title: 'Sticky Fingers', icon: 'seaglass' as const },
  { id: 'tokens', name: 'Whittled Down', goal: 'Find all 8 carved tokens', count: 8, event: 'token', title: 'Token Gesture', icon: 'coin' as const },
  { id: 'secrets', name: 'Off the Beaten Path', goal: 'Find the 3 secrets: the lookout bench, the hollow log, the islet', count: 3, event: 'secret', title: 'Professional Wanderer', icon: 'check' as const },
  { id: 'streak', name: 'Lodge Regular', goal: 'Claim 5 lodge contracts in a row (none torn down)', count: 5, event: 'streak', title: 'Contractually Obligated', icon: 'check' as const },
  { id: 'miller', name: 'Grist for the Mill', goal: "Clear the thralls off the millrace for the miller", count: 1, event: 'miller', title: 'Run of the Mill', icon: 'poi' as const },
  { id: 'thralls', name: 'Weed Control', goal: 'Put down 10 thralls', count: 10, event: 'thrall', title: 'Moss Remover', icon: 'lock' as const },
  { id: 'journal', name: 'Field Notes', goal: "Fill every page of the hunter's journal", count: 1, event: 'journal', title: 'Published Naturalist', icon: 'laurel' as const },
];


/** Pine Hollow's pack: only what Mott the trader takes (src/shards/pine-hollow/quest/trades.ts; E314 pick C) — nothing else drops there */
export const PINE_PACK_KINDS = ['venison', 'deer-hide', 'boar-hide', 'boar-tusk', 'bear-pelt', 'amber-resin', 'lodge-ribbon'] as const;
export type PineItem = (typeof PINE_PACK_KINDS)[number];
/** one slot per kept kind: Pine Hollow's pack can never be full */
export const PINE_PACK_SLOTS = PINE_PACK_KINDS.length;

/** Preserve historical native numeric stacks and the seven-kind snapshot roster. */
export const PINE_NATIVE_PACK = { kinds: PINE_PACK_KINDS, slots: PINE_PACK_SLOTS,
  counts: { min: -1_000_000, max: 1_000_000, integer: false, complete: false }, quantity: 'unchecked', snapshot: 'roster',
  restoreError: 'Incompatible Pine pack continuation' } as const;

/** Authored rewards and trade goods, including legacy ids used by save migration. */
export const PINE_BAG_ITEMS = [
  { id: 'ironhide-tusk', label: "Ironhide's broken tusk", icon: 'tusk', travels: false },
  { id: 'ghost-antler', label: 'Pale antler', icon: 'antlers', travels: false },
  { id: 'blackpaw-claw', label: "Old Blackpaw's claw", icon: 'claw', travels: false },
  { id: 'imperial-crown', label: 'Seven-tine crown', icon: 'antlers', travels: false },
  { id: 'amber-heartwood', label: 'Amber heartwood', icon: 'laurel', travels: false },
  { id: 'warden-longbow', label: "The Warden's Longbow", icon: 'longbow', travels: false },
  { id: 'amber-resin', label: 'Amber resin', icon: 'seaglass', travels: false },
  { id: 'lodge-ribbon', label: 'Lodge ribbon', icon: 'laurel', travels: false },
] as const;

/** Flag totals preserve event order and suppress unraised one-shot events. */
export const PINE_FLAG_FEATS=[
  {id:'lantern',method:'event',value:{flags:LANTERN_FLAGS}},
  {id:'resin',method:'event',value:{prefix:RESIN_FLAG}},
  {id:'token',method:'event',value:{prefix:TOKEN_FLAG}},
  {id:'secret',method:'event',value:{flags:SECRET_FLAGS}},
  {id:'zipline',method:'event',value:{flag:'used:ph-zip'},onlyWhenSet:true},
  {id:'miller',method:'event',value:{flag:'errand:done'},onlyWhenSet:true},
  {id:'king',method:'event',value:{flag:'dead:king'},onlyWhenSet:true},
  {id:'quest',method:'event',value:{flag:QUEST_DONE},onlyWhenSet:true},
] as const;

/** Native/page feat counters retain numeric totals and write before stable emission. */
export const PINE_FEAT_COUNTERS={feats:PINE_FEATS,flags:PINE_FLAG_FEATS,prefix:'pine.feat.',floorTotals:false,validateTotals:false,write:'before'} as const;
