/**
 * The forest floor's plants and litter, as their models read them (E315 M2): src/shards/pine-hollow/world/undergrowth.ts is the field — it
 * places the ~22 000 copies and builds each kind's geometry, texture and shader material (faded out past the tier's
 * range and swayed by the wind in the vertex shader). It hands its kinds here; the models (../models/fern.ts, shrub.ts,
 * needleLitter.ts, pebbles.ts, moss.ts, reeds.ts) draw with the field's parts (`underPart`: `place` instances them,
 * ./drawnModels.ts) and stand their Explorer specimen in a plain material of the same geometry and texture
 * (`underSpecimen`: the field's shader fades a copy by the player's distance, so a turntable copy would vanish).
 */
import * as THREE from 'three';
import type { ModelContext, ModelPart } from '@wildshard/engine/models/model';
import type { UnderPlacements } from '@wildshard/engine/world/forest/placement';
import * as v from 'valibot';
import type { UnderKind, UnderKindDraw } from './undergrowth';
import underJson from '../data/undergrowth.json' with { type: 'json' };

/** a kind's shape: its Float32 attributes and its triangles (G285: baked by ../generators/undergrowth.ts) */
export interface UnderShape { position: number[]; normal: number[]; uv: number[]; index: number[] }
export type UnderShapes = Record<UnderKind, UnderShape>;
const num = v.pipe(v.number(), v.finite());
const Shape = v.strictObject({ position: v.array(num), normal: v.array(num), uv: v.array(num), index: v.array(v.pipe(v.number(), v.integer(), v.minValue(0))) });
/** ../data/undergrowth.json's shape */
export const UnderShapesSchema = v.strictObject({ ferns: Shape, shrubs: Shape, litter: Shape, stones: Shape, moss: Shape, reeds: Shape });
/** each kind's shape, baked (G285: ../generators/undergrowth.ts → ../data/undergrowth.json): ./undergrowth.ts builds its geometry from it */
export const UNDER_SHAPES: UnderShapes = v.parse(UnderShapesSchema, underJson);

const KEY = 'pine-hollow/undergrowth';

/** what the field hands its models: its kinds' parts and where every copy stands */
export interface UnderField { readonly kinds: Readonly<Record<UnderKind, UnderKindDraw>>; readonly placements: UnderPlacements }

/** hand the field's kinds to the models */
export function useUndergrowth(ctx: ModelContext, field: UnderField): void { ctx.once(KEY, () => field); }

const fieldOf = (ctx: ModelContext): UnderField => ctx.once<UnderField>(KEY, () => { throw new Error('[undergrowth] not built (useUndergrowth)'); });

/** a kind's part as the field draws it: its geometry, its shader material, its shadow */
export function underPart(ctx: ModelContext, kind: UnderKind): ModelPart[] {
  const k = fieldOf(ctx).kinds[kind];
  return [{ geometry: k.geometry, material: k.material, castShadow: k.castShadow, receiveShadow: true, ...(k.customDepthMaterial ? { customDepthMaterial: k.customDepthMaterial } : {}) }];
}

/** a kind's specimen part: the field's geometry, its texture in a plain lit material (one per kind per shard) */
export function underSpecimen(ctx: ModelContext, kind: UnderKind): ModelPart[] {
  const field = fieldOf(ctx), k = field.kinds[kind], first = field.placements[kind][0];
  const material = ctx.once(`${KEY}:${kind}`, () => {
    const src = k.material;
    const m = new THREE.MeshStandardMaterial({ map: src.map, alphaTest: src.alphaTest, side: THREE.DoubleSide, roughness: src.roughness, metalness: 0 });
    m.name = `${src.name}-specimen`;
    // the field tints every copy; the specimen wears its first copy's tint
    if (first) m.color.setRGB(first.r, first.g, first.b);
    ctx.sky.setupMaterial(m);
    return m;
  });
  return [{ geometry: k.geometry, material, castShadow: true, receiveShadow: true }];
}
