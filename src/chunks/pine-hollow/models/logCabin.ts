/**
 * The log cabin (E315 M2; PINE-HOLLOW-REMASTER): the Hollow's three, one variant each — the ranger's cabin in the Hollow,
 * the east cabin, the ridge cabin (Cabin.ts SPECS: their sizes, porches, chimneys, interiors).
 * Built in code on the cabins' log kit (src/world/Cabin.ts: notched log walls on a stone plinth, a shingled roof, its
 * windows, door, porch and furniture) and drawn by the homestead (the cabins' cores merged across the three by material,
 * the hamlet as one merged cluster, the detail and far sets dropped with distance), so `place` is told its copy is drawn
 * already (`drawnInto`, src/chunks/pine-hollow/world/cabins.ts) and carries its colliders and floors. The Explorer's
 * specimen is the building built alone (src/chunks/pine-hollow/world/cabinKit.ts).
 */
import { defineModel } from '../../../models/model';
import { buildingSpecimen } from '../world/cabinKit';

export const CABIN_VARIANTS = ['hollow', 'east', 'ridge'] as const;

export interface LogCabinParams { readonly site: number }

export const logCabin = defineModel<LogCabinParams>({
  id: 'pine-hollow/log-cabin', name: 'Log cabin', category: 'buildings', pipeline: 'code',
  file: 'src/chunks/pine-hollow/models/logCabin.ts', surface: 'wood',
  defaults: { site: 0 },
  variants: [
    { id: 'hollow', label: "The ranger's (the Hollow)", params: { site: 0 } },
    { id: 'east', label: 'East', params: { site: 1 } },
    { id: 'ridge', label: 'Ridge', params: { site: 2 } },
  ],
  build: (ctx, p) => buildingSpecimen(ctx, `cabin-${p.site + 1}`),
});
