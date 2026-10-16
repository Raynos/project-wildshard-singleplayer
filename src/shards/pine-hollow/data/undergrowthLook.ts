/**
 * Pine Hollow's forest-floor undergrowth as data (SHARD-PLATFORM M3): each kind's look on the shard's ground cover
 * (runtime/looks/groundCover.ts): its wind, alpha cut, roughness, whether it lies flat or casts a shadow, in the order
 * their materials are made, and the SF59 material graph each wears (`UNDER_GRAPHS`, the shardfile's look.materials, by
 * the row's `graph` id; one graph compiled once, with mapped clones sharing its program). A kind wears its graph over its own painted
 * texture (`meshMap`); its alpha cut, roughness and depth bias are its material's, its wind the `aWind` its geometry
 * carries.
 */

/** The undergrowth's look: the material names, and the six kinds (each with its graph's look.materials id). */
export const UNDER_LOOK = {
  namePrefix: 'under-',
  kinds: [
    ['ferns', { key: 'fern', graph: 'pine-undergrowth', wind: 0.35, alphaTest: 0.5, shadow: true }],
    ['shrubs', { key: 'shrub', graph: 'pine-undergrowth', wind: 0.25, alphaTest: 0.5, shadow: true }],
    ['litter', { key: 'litter', graph: 'pine-undergrowth', wind: 0, alphaTest: 0.35, roughness: 1, flat: true, shadow: false }],
    ['stones', { key: 'stone', graph: 'pine-undergrowth', wind: 0, alphaTest: 0.5, roughness: 0.75, flat: true, shadow: false }],
    ['moss', { key: 'moss', graph: 'pine-undergrowth', wind: 0, alphaTest: 0.4, roughness: 1, flat: true, shadow: false }],
    ['reeds', { key: 'reed', graph: 'pine-undergrowth', wind: 0.5, alphaTest: 0.45, shadow: true }],
  ],
} as const;
