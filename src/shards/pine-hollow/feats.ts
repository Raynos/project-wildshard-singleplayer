import type { AchievementDef } from '@wildshard/game/achievements';

export const PINE_FEATS: AchievementDef[] = [
  { id: 'deer5', name: 'Deerstalker', goal: 'Kill 5 deer', count: 5, kind: 'deer', title: 'Antler Management', icon: 'deer' },
  { id: 'boar5', name: 'Hog Wild', goal: 'Kill 5 boar', count: 5, kind: 'boar', title: 'Bacon Procurement Officer', icon: 'boar' },
  { id: 'elk3', name: 'Big Game', goal: 'Kill 3 elk', count: 3, kind: 'elk', title: 'Elk Yeah', icon: 'elk' },
  { id: 'bear2', name: 'Apex', goal: 'Kill 2 bear', count: 2, kind: 'bear', title: 'Unbearable', icon: 'bear' },
  { id: 'ghost', name: 'Ghost Story', goal: 'Kill the Ghost stag', count: 1, kind: 'deer', variant: 'ghost', title: 'Ghostbuster', icon: 'ghost' },
  { id: 'ironhide', name: 'Old Ironhide', goal: 'Kill Old Ironhide', count: 1, kind: 'boar', variant: 'ironhide', title: "Ironhide's Retirement Plan", icon: 'ironhide' },
  // PH-C10 (the remaster): the other two elites, the King, the lantern quest, the collectibles, the lodge, the night
  { id: 'blackpaw', name: 'Eviction Notice', goal: 'Kill Old Blackpaw', count: 1, kind: 'bear', variant: 'black-old', title: 'Landlord of the Den', icon: 'claw' },
  { id: 'imperial', name: 'Seven by Seven', goal: 'Kill the Imperial Bull', count: 1, kind: 'elk', variant: 'imperial', title: 'Crown Jeweller', icon: 'antlers' },
  { id: 'king', name: 'The Last Light', goal: 'Defeat the Antler King', count: 1, event: 'king', title: 'Regicide, Rustic', icon: 'antlers' },
  { id: 'lanterns', name: 'Lamplighter', goal: 'Relight the three waystone lanterns', count: 3, event: 'lantern', title: 'Wick Whisperer', icon: 'poi' },
  { id: 'quest', name: "The Warden's Hollow", goal: 'See the dawn over the Hollow', count: 1, event: 'quest', title: 'Morning Person, Finally', icon: 'laurel' },
  { id: 'zipline', name: 'Lookout Below', goal: 'Ride the zipline off the fire lookout', count: 1, event: 'zipline', title: "Gravity's Favourite", icon: 'rope' },
  { id: 'resin', name: 'Sap Happens', goal: 'Collect all 30 amber resin drops', count: 30, event: 'resin', title: 'Sticky Fingers', icon: 'seaglass' },
  { id: 'tokens', name: 'Whittled Down', goal: 'Find all 8 carved tokens', count: 8, event: 'token', title: 'Token Gesture', icon: 'coin' },
  { id: 'secrets', name: 'Off the Beaten Path', goal: 'Find the 3 secrets: the lookout bench, the hollow log, the islet', count: 3, event: 'secret', title: 'Professional Wanderer', icon: 'check' },
  { id: 'streak', name: 'Lodge Regular', goal: 'Claim 5 lodge contracts in a row (none torn down)', count: 5, event: 'streak', title: 'Contractually Obligated', icon: 'check' },
  { id: 'miller', name: 'Grist for the Mill', goal: "Clear the thralls off the millrace for the miller", count: 1, event: 'miller', title: 'Run of the Mill', icon: 'poi' },
  { id: 'thralls', name: 'Weed Control', goal: 'Put down 10 thralls', count: 10, event: 'thrall', title: 'Moss Remover', icon: 'lock' },
  { id: 'journal', name: 'Field Notes', goal: "Fill every page of the hunter's journal", count: 1, event: 'journal', title: 'Published Naturalist', icon: 'laurel' },
];

