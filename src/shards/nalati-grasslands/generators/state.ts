/** Nalati's bounded host-owned continuation fields; stable ids survive revision migrations. */
export const NALATI_STATE = { version: 1, sharedOwner: 'host', playerKey: 'actorId', player: [], shared: [
  { id: 1, name: 'nalati.horse-names', type: 'string', privacy: 'host', default: '{}' },
  { id: 2, name: 'nalati.cosmetics', type: 'string', privacy: 'host', default: '{"owned":[],"worn":{}}' },
  { id: 3, name: 'nalati.bosses', type: 'string', privacy: 'host', default: '{}' },
  { id: 4, name: 'nalati.elites', type: 'string', privacy: 'host', default: '{}' },
  { id: 5, name: 'nalati.feat-counts', type: 'string', privacy: 'host', default: '{}' },
  { id: 6, name: 'nalati.bond', type: 'string', privacy: 'host', default: '' },
] } as const;
