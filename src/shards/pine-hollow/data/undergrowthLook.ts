/**
 * Pine Hollow's forest-floor undergrowth as data (SHARD-PLATFORM M3): each kind's look on the SDK ground cover
 * (@wildshard/sdk/looks/groundCover) — its wind, alpha test, roughness, whether it lies flat or casts a shadow — in the
 * order their materials are made, and the patch ids / program keys every kind shares (ONE lit program, one depth program).
 * The edits are ./forestLook.ts `UNDER_EDITS` / `UNDER_VERTEX_EDITS`; the textures are painted by world/undergrowth.ts.
 */

/** The undergrowth's look: the patches, the material names, and the six kinds. */
export const UNDER_LOOK = {
  patch: { lit: 'pine.undergrowth', depth: 'pine.undergrowth-depth' },
  keys: { lit: 'under', depth: 'under-depth' },
  namePrefix: 'under-',
  kinds: [
    ['ferns', { key: 'fern', wind: 0.35, alphaTest: 0.5, shadow: true }],
    ['shrubs', { key: 'shrub', wind: 0.25, alphaTest: 0.5, shadow: true }],
    ['litter', { key: 'litter', wind: 0, alphaTest: 0.35, roughness: 1, flat: true, shadow: false }],
    ['stones', { key: 'stone', wind: 0, alphaTest: 0.5, roughness: 0.75, flat: true, shadow: false }],
    ['moss', { key: 'moss', wind: 0, alphaTest: 0.4, roughness: 1, flat: true, shadow: false }],
    ['reeds', { key: 'reed', wind: 0.5, alphaTest: 0.45, shadow: true }],
  ],
} as const;
