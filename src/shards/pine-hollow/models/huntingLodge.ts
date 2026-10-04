/**
 * Hunting lodge (E315 M2; PINE-HOLLOW-REMASTER PH-B3 / C6): the mill hamlet's long log hall with a deep porch, its hall furnished; the contract board stands by its steps. One of the mill hamlet's five buildings (the set
 * `pine-hollow/mill-hamlet`; src/shards/pine-hollow/world/landmarks.ts `pineHamletBuildings`).
 * Built in code on the log kit (./logCabin.ts: notched log walls on a stone plinth, a shingled roof, its windows, door,
 * porch and furniture), where it stands; `place` welds it with the hamlet's other four into one set, dropped with distance
 * (`ModelDef.weld`, src/shards/pine-hollow/world/cabins.ts, E347). The Explorer's specimen is the building built alone.
 */
import { defineModel } from '@wildshard/engine/models/model';
import { buildingSpecimen, builtBuilding } from './logCabin';

export const huntingLodge = defineModel<Record<string, never>>({
  id: 'pine-hollow/hunting-lodge', name: "Hunting lodge", category: 'buildings', pipeline: 'code',
  file: 'src/shards/pine-hollow/models/huntingLodge.ts', surface: 'wood',
  defaults: {},
  build: (ctx) => buildingSpecimen(ctx, 'hunting-lodge'),
  weld: (ctx) => builtBuilding(ctx, 'hunting-lodge'),
});
