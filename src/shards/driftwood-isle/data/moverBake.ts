/**
 * Driftwood's mover bake (G348: declared here, read by the generic `scripts/bake/movers.mjs`, schema
 * `@wildshard/format/movers` `MoverBakeSchema`): the boat rides the waves, the rope bridge hangs on a hinge, and
 * `captureDriftwoodMovers(boat, bridge)` in `generators/movers.ts` writes `data/movers.ts` from their hashes.
 */
export const MOVER_BAKE = {
  capture: 'captureDriftwoodMovers',
  modules: [{ file: 'boat.as', driver: 'waves' }, { file: 'bridge.as', driver: 'hinge' }],
} as const;
