/**
 * Watermill (E315 M2; PINE-HOLLOW-REMASTER PH-B3 / C6): its stones inside, the wheel wing on stilts out over the creek (fitted to the bank), the wheel turning past its end. One of the mill hamlet's five buildings (the set
 * `pine-hollow/mill-hamlet`; src/world/PineLandmarks.ts `pineHamletBuildings`).
 * Built in code on the log kit (./logCabin.ts: notched log walls on a stone plinth, a shingled roof, its windows, door,
 * porch and furniture), where it stands; `place` welds it with the hamlet's other four into one set, dropped with distance
 * (`ModelDef.weld`, src/chunks/pine-hollow/world/cabins.ts, E347). The Explorer's specimen is the building built alone.
 */
import { defineModel } from '../../../models/model';
import { buildingSpecimen, builtBuilding } from './logCabin';

export const watermill = defineModel<Record<string, never>>({
  id: 'pine-hollow/watermill', name: "Watermill", category: 'buildings', pipeline: 'code',
  file: 'src/chunks/pine-hollow/models/watermill.ts', surface: 'wood',
  defaults: {},
  build: (ctx) => buildingSpecimen(ctx, 'watermill'),
  weld: (ctx) => builtBuilding(ctx, 'watermill'),
});
