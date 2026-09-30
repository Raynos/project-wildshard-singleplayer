/**
 * The forest floor's plants and litter, as their models read them (E315 M2): src/world/Undergrowth.ts builds each kind's
 * geometry and texture in code and draws the ~22 000 copies itself (one InstancedMesh per kind, culled per 32 m cell
 * round the forest's view, faded out past the tier's range, swayed by the wind in the shader) — the field is the world.
 * It hands its meshes here; the models (../models/fern.ts, shrub.ts, needleLitter.ts, pebbles.ts, moss.ts, reeds.ts)
 * build their Explorer specimen from the same geometry and texture in a plain material (the field's shader expects its
 * instance attributes).
 */
import * as THREE from 'three';
import type { ModelContext, ModelPart } from '../../../models/model';
import type { UnderPlacements } from '../../../world/placement';

export type UnderKind = 'ferns' | 'shrubs' | 'litter' | 'stones' | 'moss' | 'reeds';

const KEY = 'pine-hollow/undergrowth';

/** what the field hands its models: its meshes and where every copy stands */
export interface UnderField { readonly meshes: Readonly<Record<UnderKind, THREE.InstancedMesh>>; readonly placements: UnderPlacements }

/** hand the field's drawn meshes to the models */
export function useUndergrowth(ctx: ModelContext, field: UnderField): void { ctx.once(KEY, () => field); }

/** a kind's specimen part: the field's geometry, its texture in a plain lit material (one per kind per shard) */
export function underPart(ctx: ModelContext, kind: UnderKind): ModelPart[] {
  const field = ctx.once<UnderField>(KEY, () => { throw new Error('[undergrowth] not built (useUndergrowth)'); });
  const im = field.meshes[kind], first = field.placements[kind][0];
  const material = ctx.once(`${KEY}:${kind}`, () => {
    const src = im.material as THREE.MeshStandardMaterial;
    const m = new THREE.MeshStandardMaterial({ map: src.map, alphaTest: src.alphaTest, side: THREE.DoubleSide, roughness: src.roughness, metalness: 0 });
    m.name = `${src.name}-specimen`;
    // the field tints every copy; the specimen wears its first copy's tint
    if (first) m.color.setRGB(first.r, first.g, first.b);
    ctx.sky.setupMaterial(m);
    return m;
  });
  return [{ geometry: im.geometry, material, castShadow: true, receiveShadow: true }];
}
