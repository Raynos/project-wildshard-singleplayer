/** Original timber material bands and native shadow flags, consumed by the shared weld owner. */
export const TIMBER_DRAWS = {
  log: { depth: 'proxy', receiveShadow: true },
  endGrain: { depth: 'proxy', receiveShadow: true, until: 2 },
  chink: { depth: 'near', receiveShadow: true, castShadow: true, until: 1 },
  roof: { depth: 'proxy', receiveShadow: true },
  beam: { depth: 'proxy', receiveShadow: true },
  deck: { depth: 'proxy', receiveShadow: true },
  door: { depth: 'proxy', receiveShadow: true, until: 2 },
  stone: { depth: 'proxy', receiveShadow: true },
  bark: { depth: 'proxy', receiveShadow: true, until: 2 },
  iron: { depth: 'near', receiveShadow: true, castShadow: true, until: 1 },
  cloth: { depth: 'near', receiveShadow: true, castShadow: true, until: 1 },
  char: { depth: 'near', receiveShadow: true, castShadow: true, until: 1 },
} as const;
export const TIMBER_GLASS = { renderOrder: 2, receiveShadow: true } as const;
