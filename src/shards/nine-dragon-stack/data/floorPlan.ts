/** Shared authoring dimensions and stable identities for Nine Dragon's portal floors and unchanged front boundaries. */
export const NINE_FLOOR_PLAN = {
  datum: 125,
  square: { x0: 0, x1: 22, z0: -26, z1: 20 },
  well: { x0: -28, x1: 0, z0: -44, z1: 16, water: -245 },
  street: { x0: 0.5, x1: 12.5, z1: -26, z0: -230 },
  stair: { z0: 2, z1: 10, x0: 22, x1: 70, rise: 21 },
  rim: { z0: 11.2 },
  balustrade: { parapet: 12, guardZ0: -18 },
  fronts: { streetEnd: -120, wallHeight: 40, depth: 6, shop: 0.6 },
  cellHalf: 250,
  openingHalf: 4,
  ids: { deckPrefix: 'deck.', square: 'square' },
} as const;
