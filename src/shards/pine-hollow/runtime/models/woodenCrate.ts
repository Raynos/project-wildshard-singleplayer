/**
 * The cabins' scanned props as rows (E315 M2, G465): Poly Haven CC0 scans (wooden crate, wine barrel, wooden bucket,
 * hatchet) set about the cabins and the hamlet by their builders. Drawn by the homestead, one InstancedMesh per scan part
 * (`drawnInto`); a copy with `box` collides as the scan's bounds (../world/cabinKit.ts `propBox`).
 */
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { propBox, propPart } from '../world/cabinKit';

const ROWS = [
  { kind: 'crate', id: 'wooden-crate', name: 'Wooden crate', box: true }, { kind: 'barrel', id: 'wine-barrel', name: 'Wine barrel', box: true },
  { kind: 'bucket', id: 'wooden-bucket', name: 'Wooden bucket', box: true }, { kind: 'hatchet', id: 'hatchet', name: 'Hatchet', box: false },
] as const;

/** The props' models, in the order the homestead places them. */
export const PROP_MODELS: readonly (readonly [(typeof ROWS)[number]['kind'], ModelDef<Record<string, never>>])[] = ROWS.map((r) => [r.kind, defineModel({
  id: `pine-hollow/${r.id}`, name: r.name, category: 'props', pipeline: 'cc0', file: 'src/shards/pine-hollow/runtime/models/woodenCrate.ts', surface: 'wood', defaults: {},
  build: (ctx) => propPart(ctx, r.kind), ...(r.box ? { colliders: () => propBox(r.kind) } : {}),
})]);
