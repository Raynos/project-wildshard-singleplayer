import source from '../shard.config';

/** Existing resident world binds the admitted boat and bridge to their real rendered/native owners. */
export const RESIDENT_WORLD = { motion: { source, systemId: 'shard.driftwood.movers', rows: [
  { id: 'driftwood.boat', target: 'boat', group: 'group', afterPose: 'refreshPose' },
  { id: 'driftwood.bridge', target: 'bridgeDeck', chain: true },
] } } as const;
