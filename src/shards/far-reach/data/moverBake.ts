/**
 * Sky Reach's mover bake (G348: declared here, read by the generic `scripts/bake/movers.mjs`, schema
 * `@wildshard/format/movers` `MoverBakeSchema`): the winch and rope bridges on a hinge, the Rising Islet a ride, and
 * `captureSkyMovers(bridges, islet)` in `generators/movers.ts` writes `data/movers.ts` from their hashes. Its shardfile
 * declares both modules as admitted files (SF8c socketLift / SF72), so their hashes are emitted as data constants too.
 */
export const MOVER_BAKE = {
  capture: 'captureSkyMovers',
  modules: [
    { file: 'bridges.as', driver: 'hinge', emit: { file: 'data/bridgeModule.ts', name: 'BRIDGE_MODULE', note: "the winch and rope bridges' admitted module (fixed hinge driver)" } },
    { file: 'islet.as', driver: 'ride', emit: { file: 'data/liftModule.ts', name: 'LIFT_MODULE', note: "the Rising Islet's admitted module (fixed ride driver)" } },
  ],
} as const;
