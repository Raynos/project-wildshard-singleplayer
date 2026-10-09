/**
 * Trader's stall (E315 M2; PINE-HOLLOW-REMASTER PH-B3 / C6): a log booth with a serving hatch, a counter and an awning; its door shut for good. One of the mill hamlet's five buildings (the set
 * `pine-hollow/mill-hamlet`; src/shards/pine-hollow/world/landmarks.ts `pineHamletBuildings`).
 * Built in code on the log kit (./logCabin.ts: notched log walls on a stone plinth, a shingled roof, its windows, door,
 * porch and furniture), where it stands; `place` welds it with the hamlet's other four into one set, dropped with distance
 * (`ModelDef.weld`, src/shards/pine-hollow/world/cabins.ts, E347). The Explorer's specimen is the building built alone.
 */
import { defineModel } from '@wildshard/engine/models/model';
import { buildingSpecimen, builtBuilding } from './logCabin';

export const traderStall = defineModel<Record<string, never>>({
  id: 'pine-hollow/trader-stall', name: "Trader's stall", category: 'buildings', pipeline: 'code',
  file: 'src/shards/pine-hollow/models/traderStall.ts', surface: 'wood',
  defaults: {},
  build: (ctx) => buildingSpecimen(ctx, 'trader-stall'),
  weld: (ctx) => builtBuilding(ctx, 'trader-stall'),
});
