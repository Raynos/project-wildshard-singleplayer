/** Shared authoring dimensions and stable identities for Nine Dragon's five portal floors. */
export const NINE_FLOOR_PLAN = {
  datum: 125,
  square: { x0: 0, x1: 22, z0: -26, z1: 20 },
  cellHalf: 250,
  openingHalf: 4,
  ids: { deckPrefix: 'deck.', square: 'square' },
} as const;
