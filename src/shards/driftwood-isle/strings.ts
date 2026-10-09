/** Driftwood Isle's level strings (ctx.strings): the death card's verb per creature, "Gored by a boar" (E405: the engine keeps no per-creature table) */
export const STRINGS = {
  'death.verb.boar': 'Gored by', 'death.verb.bear': 'Mauled by', 'death.verb.crab': 'Snapped up by', 'death.verb.monkey': 'Mobbed by',
  'death.verb.sailor': 'Cut down by', 'death.verb.deer': 'Trampled by', 'death.verb.elk': 'Trampled by',
} as const;

/** SF72: the pier ramps' Debug row (world/pierRamps.ts), until Jake picks */
export const PIER_RAMP_STRINGS = { label: 'Driftwood pier ramps', flared: 'Flared', straight: 'Straight' } as const;
