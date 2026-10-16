/** Existing talk prompt labels, reach, greeting hysteresis and frame order. */
export const QUEST_NPCS = {
  ranger: { id: 'npc-ranger', label: 'Talk to Hale', radius: 3.2, copyPrompt: true, updateOrder: 'figure-first', file: 'src/shards/pine-hollow/quest/index.ts', bark: { enter: 7, leave: 16 } },
  miller: { id: 'npc-miller', label: 'Talk to Brandt, the miller', radius: 3.2, copyPrompt: true, updateOrder: 'figure-first', file: 'src/shards/pine-hollow/quest/index.ts', bark: { enter: 7, leave: 16 } },
  trader: { id: 'npc-trader', label: 'Trade with Mott', radius: 3.2, copyPrompt: true, updateOrder: 'figure-first', file: 'src/shards/pine-hollow/quest/index.ts', bark: { enter: 7, leave: 16 } },
} as const;
