// Nine Dragon Stack's named places (E315 M12: every named place is a Set). One row per place; each one's Set says so
// with `place: 'nine-dragon-stack/<id>'` (world/sets.ts, world/squareProps.ts) and lists the models placed there — the
// place's welded ground stays world. scripts/check-models.mjs fails a place no set names.
export const NINE_DRAGON_PLACES = [
  { id: 'lantern-square', label: 'LANTERN SQUARE' },
  { id: 'night-market', label: 'NIGHT MARKET' },
  { id: 'stair-street', label: 'STAIR-STREET' },
  { id: 'well-rim', label: 'THE WELL RIM' },
  { id: 'well-galleries', label: 'WELL GALLERIES' },
  { id: 'crossings', label: 'THE CROSSINGS' },
] as const;
