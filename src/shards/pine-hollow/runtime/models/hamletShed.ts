/**
 * Hamlet shed (E315 M2; PINE-HOLLOW-REMASTER PH-B3 / C6): a small log store with a lean-to of firewood on its end. One of the mill hamlet's five buildings (the set
 * `pine-hollow/mill-hamlet`; src/shards/pine-hollow/generators/logCabin.ts `hamletBuildings`).
 * Built in code on the log kit (./logCabin.ts: notched log walls on a stone plinth, a shingled roof, its windows, door,
 * porch and furniture), where it stands; `place` welds it with the hamlet's other four into one set, dropped with distance
 * (`ModelDef.weld`, src/shards/pine-hollow/world/cabins.ts, E347). The Explorer's specimen is the building built alone.
 */
import { defineModel } from '@wildshard/engine/models/model';
import { buildingSpecimen, builtBuilding } from './logCabin';

export const hamletShed = defineModel<Record<string, never>>({
  id: 'pine-hollow/hamlet-shed', name: "Hamlet shed", category: 'buildings', pipeline: 'code',
  file: 'src/shards/pine-hollow/models/hamletShed.ts', surface: 'wood',
  defaults: {},
  build: (ctx) => buildingSpecimen(ctx, 'hamlet-shed'),
  weld: (ctx) => builtBuilding(ctx, 'hamlet-shed'),
});
