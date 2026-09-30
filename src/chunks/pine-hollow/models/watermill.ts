/**
 * Watermill (E315 M2; PINE-HOLLOW-REMASTER PH-B3 / C6): its stones inside, the wheel wing on stilts out over the creek (fitted to the bank), the wheel turning past its end. One of the mill hamlet's five buildings (the set
 * `pine-hollow/mill-hamlet`; src/world/PineLandmarks.ts `pineHamletBuildings`).
 * Built in code on the cabins' log kit (src/world/Cabin.ts: notched log walls on a stone plinth, a shingled roof, its
 * windows, door, porch and furniture) and drawn by the homestead (the cabins' cores merged across the three by material,
 * the hamlet as one merged cluster, the detail and far sets dropped with distance), so `place` is told its copy is drawn
 * already (`drawnInto`, src/chunks/pine-hollow/world/cabins.ts) and carries its colliders and floors. The Explorer's
 * specimen is the building built alone (src/chunks/pine-hollow/world/cabinKit.ts).
 */
import { defineModel } from '../../../models/model';
import { buildingSpecimen } from '../world/cabinKit';

export const watermill = defineModel<Record<string, never>>({
  id: 'pine-hollow/watermill', name: "Watermill", category: 'buildings', pipeline: 'code',
  file: 'src/chunks/pine-hollow/models/watermill.ts', surface: 'wood',
  defaults: {},
  build: (ctx) => buildingSpecimen(ctx, 'watermill'),
});
