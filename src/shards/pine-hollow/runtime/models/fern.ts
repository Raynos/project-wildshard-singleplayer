/**
 * The forest floor's kinds as rows (E315 M2, G465): ferns, bilberry shrubs, needle litter, pebbles, moss and reeds, drawn
 * by the ground cover's field in its own shader (geometry, texture and material: ../looks/groundCover.ts); `place` draws
 * every copy of a kind in one InstancedMesh, culled per cell round the forest's view (../world/drawnModels.ts). The
 * Explorer's specimen wears a plain material. Walked through: no collider.
 */
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { underPart, underSpecimen } from '../world/undergrowthKit';

const ROWS = [
  { kind: 'ferns', id: 'fern', name: 'Fern' }, { kind: 'shrubs', id: 'bilberry-shrub', name: 'Bilberry shrub' },
  { kind: 'litter', id: 'needle-litter', name: 'Needle litter' }, { kind: 'stones', id: 'pebbles', name: 'Pebbles' },
  { kind: 'moss', id: 'moss-patch', name: 'Moss patch' }, { kind: 'reeds', id: 'reeds', name: 'Reeds' },
] as const;

/** The floor's kinds with their models, in the order the floor places them. */
export const UNDER_MODELS: readonly (readonly [ModelDef<Record<string, never>>, (typeof ROWS)[number]['kind']])[] = ROWS.map((r) => [defineModel({
  id: `pine-hollow/${r.id}`, name: r.name, category: 'nature', pipeline: 'code', file: 'src/shards/pine-hollow/runtime/models/fern.ts', defaults: {},
  build: (ctx) => underPart(ctx, r.kind), specimen: (ctx) => underSpecimen(ctx, r.kind),
}), r.kind]);
