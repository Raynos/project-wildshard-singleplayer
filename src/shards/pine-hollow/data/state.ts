/** Mutable native continuations use the template state contract; the platform owns their durable writes. */
export const PINE_STATE = { version: 1, sharedOwner: 'host', playerKey: 'actorId', player: [], shared: [
  { id: 1, name: 'pine.lodge', type: 'string', privacy: 'host', default: 'null' },
  { id: 2, name: 'pine.loadout', type: 'string', privacy: 'host', default: '{}' },
  { id: 3, name: 'pine.bosses', type: 'string', privacy: 'host', default: '{}' },
  { id: 4, name: 'pine.elites', type: 'string', privacy: 'host', default: '{}' },
  { id: 5, name: 'pine.feat-counts', type: 'string', privacy: 'host', default: '{}' },
] } as const;
