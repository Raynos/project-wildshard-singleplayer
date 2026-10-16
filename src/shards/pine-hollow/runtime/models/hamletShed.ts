/**
 * The mill hamlet's five buildings as rows (E315 M2; PINE-HOLLOW-REMASTER PH-B3 / C6, G465): each baked on the log kit
 * (src/shards/pine-hollow/generators/logCabin.ts `hamletBuildings`: notched log walls on a stone plinth, a shingled roof,
 * windows, door, porch and furniture) where it stands; `place` welds the five into one set, dropped with distance
 * (`ModelDef.weld`, ../world/cabins.ts, E347). The Explorer's specimen is the building built alone.
 */
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { buildingSpecimen, builtBuilding } from './logCabin';

const ROWS = [
  { id: 'hunting-lodge', name: 'Hunting lodge' }, { id: 'trader-stall', name: "Trader's stall" },
  { id: 'millers-house', name: "Miller's house" }, { id: 'watermill', name: 'Watermill' }, { id: 'hamlet-shed', name: 'Hamlet shed' },
] as const;

/** The hamlet's building models by their bake id. */
export const HAMLET_MODELS: Readonly<Record<string, ModelDef<Record<string, never>>>> = Object.fromEntries(ROWS.map((r) => [r.id, defineModel({
  id: `pine-hollow/${r.id}`, name: r.name, category: 'buildings', pipeline: 'code', file: 'src/shards/pine-hollow/runtime/models/hamletShed.ts', surface: 'wood', defaults: {},
  build: (ctx) => buildingSpecimen(ctx, r.id), weld: (ctx) => builtBuilding(ctx, r.id),
})]));
