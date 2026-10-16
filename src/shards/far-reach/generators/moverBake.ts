/**
 * Sky Reach's mover bake (G348: declared here, read by the generic `scripts/bake/movers.mjs`, schema
 * `@wildshard/format/movers` `MoverBakeSchema`): the winch and rope bridges on a hinge, the Rising Islet a ride, and
 * `captureSkyMovers(bridges, islet)` in `generators/movers.ts` writes `data/movers.generated.json` from their hashes. Its shardfile
 * declares both modules as admitted files (SF8c socketLift / SF72), so their hashes are emitted as data constants too.
 */
export const MOVER_BAKE = {
  capture: 'captureSkyMovers', output: 'json', execution: 'native',
  modules: [
    { file: 'bridges.as', driver: 'hinge' },
    { file: 'islet.as', driver: 'ride' },
  ],
} as const;
