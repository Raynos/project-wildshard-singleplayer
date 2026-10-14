/** Wendell's existing talk reach and one-time unsaved greeting. */
export const CASTAWAY_TALK = { id: 'npc-castaway', label: 'Talk to Wendell', radius: 3.2, copyPrompt: false,
  updateOrder: 'talk-first', file: 'src/shards/driftwood-isle/quest/Spine.ts', approach: { radius: 16, unlessFlag: 'talked:castaway' } } as const;
