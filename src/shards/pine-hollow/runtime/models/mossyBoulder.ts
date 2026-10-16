import type * as THREE from 'three';
import * as v from 'valibot';
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import { loadSiteTimbers, propShapeGeometry } from '../world/timberSites';
import { loadLodNodes, prepModel } from '../world/homestead';

const finite = v.pipe(v.number(), v.finite());
const shapeFields = { name: v.string(), sphere: v.tuple([finite, finite, finite, v.pipe(finite, v.minValue(0))]) };
const hull = v.strictObject({ ...shapeFields, hull: v.pipe(v.array(finite), v.maxLength(8192)) });
/** Original geometry names, bounds, hulls and capsule; no procedural reconstruction. */
export const PropShapesSchema = v.strictObject({ rocks: v.pipe(v.array(hull), v.length(6)), stumps: v.pipe(v.array(hull), v.maxLength(128)),
  log: v.strictObject({ parts: v.pipe(v.array(hull), v.maxLength(128)), capsule: v.strictObject({ kind: v.literal('capsule'),
    x: finite, y: finite, z: finite, halfHeight: finite, radius: finite, rot: v.strictObject({ x: finite, y: finite, z: finite, w: finite }) }) }) });
type ShapeRows = v.InferOutput<typeof PropShapesSchema>;
type Kind = 'rocks' | 'stumps' | 'log';
interface Part { draw: ModelPart; hull: Float32Array }
interface Prepared { parts: Part[]; capsule: ShapeRows['log']['capsule'] }
const key = (kind: Kind): string => `pine-hollow/prop:${kind}`;
export const propScan = (ctx: ModelContext, kind: Kind): Prepared => ctx.once<Prepared>(key(kind), () => { throw new Error(`[props] load ${kind} before building`); });

const shapeRows = new WeakMap<ShardProduct, Promise<ShapeRows>>();
async function loadShapes(): Promise<ShapeRows> {
  const product = await loadFirstPartyProduct('pine-hollow');
  let pending = shapeRows.get(product);
  if (pending === undefined) {
    pending = product.file('world/prop-shapes.json').then(bytes => v.parse(PropShapesSchema, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))));
    shapeRows.set(product, pending);
  }
  return pending;
}

/** A single context-owned metadata read; each scan retains its original material-preparation order. */
export async function loadProp(ctx: ModelContext, kind: Kind, scan: string): Promise<void> {
  const [nodes, views, rows] = await Promise.all([loadLodNodes(scan), loadSiteTimbers(ctx), loadShapes()]);
  ctx.once(key(kind), (): Prepared => {
    const part = (row: ShapeRows['rocks'][number], material: THREE.Material): Part => ({
      draw: { geometry: propShapeGeometry(views, row.name, row.sphere), material, castShadow: true, receiveShadow: true },
      hull: new Float32Array(row.hull),
    });
    const parts = kind === 'rocks' ? rows.rocks.map(row => {
      const first = prepModel(nodes, ctx.sky)[0]; if (first === undefined) throw new Error('[props] missing scan material');
      return part(row, first.material);
    }) : prepModel(nodes, ctx.sky).map((source, i) => {
      const row = (kind === 'stumps' ? rows.stumps : rows.log.parts)[i];
      if (row === undefined) throw new Error(`[props] missing authored ${kind}`);
      return part(row, source.material);
    });
    return { parts, capsule: rows.log.capsule };
  });
}

export const BOULDER_SHAPES = ['a', 'b', 'c', 'd', 'e', 'f'] as const;
export interface MossyBoulderParams { readonly shape: number; readonly solid: boolean }
export const loadMossyBoulder = (ctx: ModelContext): Promise<void> => loadProp(ctx, 'rocks', 'rock_moss_set_01');

/** Poly Haven's six mossy rocks, with the shipping shape indices and solid-placement policy. */
export const mossyBoulder = defineModel<MossyBoulderParams>({
  id: 'pine-hollow/mossy-boulder', name: 'Mossy boulder', category: 'nature', pipeline: 'cc0',
  file: 'src/shards/pine-hollow/models/mossyBoulder.ts', surface: 'rock', defaults: { shape: 0, solid: true },
  variants: BOULDER_SHAPES.map((id, shape) => ({ id, label: `Rock ${id.toUpperCase()}`, params: { shape } })),
  build: (ctx, p) => { const s = propScan(ctx, 'rocks').parts[p.shape]; return s === undefined ? [] : [s.draw]; },
  colliders: (p, ctx) => { const s = propScan(ctx, 'rocks').parts[p.shape]; return p.solid && s !== undefined ? [{ kind: 'hull', x: 0, y: 0, z: 0, points: s.hull }] : []; },
});
