import { CrowdPresentationSchema } from '@wildshard/format/crowdPresentation';
import { FlockSchema, parseFlock } from '@wildshard/format/crowds';
import { app } from '@wildshard/engine/app/runtime';
import * as v from 'valibot';
import { readBakedGeometry, bakedGeometryBytes } from '../plugin/geometry';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { prepareDeclaredCrowds, type PreparedCrowds, type CrowdObservation } from '@wildshard/game/shardfile/crowdRuntime';
import { terrainHeight as heightAt, terrainNormal as normalAt } from '@wildshard/engine/world/terrainHeight';
import { Vector3 } from 'three';
import { CrowdDraw as Flock, type CrowdBody as FlockBody } from '@wildshard/game/ambient/crowdDraw';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import { productRiggedHulls } from '../looks/riggedHulls';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { wildEnv } from '@wildshard/game/population/pageGroups';

/** Admit the flock's exact static geometry and original seven shader pivots before any view builds. */
export async function readCrowdBody(product: Pick<ShardProduct, 'file'>, files: { readonly json: string; readonly binary: string }): Promise<FlockBody> {
  const number = v.pipe(v.number(), v.finite()), whole = v.pipe(number, v.integer(), v.minValue(0));
  const value = v.parse(v.object({ row: v.strictObject({
    attrs: v.array(v.tuple([v.string(), v.literal('f32'), whole, v.boolean()])), count: whole,
    index: v.nullable(v.picklist(['u16', 'u32'])), indexCount: whole, box: v.boolean() }),
    pivots: v.pipe(v.array(v.tuple([number, number, number])), v.maxLength(32)),
    parts: v.pipe(v.array(v.string()), v.maxLength(32)), radius: number,
  }), JSON.parse(new TextDecoder().decode(await product.file(files.json))));
  if (value.parts.length === 0 || value.parts.length !== value.pivots.length || value.radius <= 0) throw new Error('Invalid crowd body joints or bound');
  const bytes = await product.file(files.binary);
  if (bytes.length !== bakedGeometryBytes(value.row)) throw new Error('Crowd geometry differs from its declared blocks');
  const geometry = readBakedGeometry(bytes, 0, value.row);
  if (geometry.boundingSphere === null) throw new Error('Crowd geometry has no bounds');
  geometry.boundingSphere.radius = value.radius;
  return { geometry, pivots: value.pivots, parts: value.parts };
}

interface FlockOpts { x: number; z: number; count: number; seed: number; range?: number }

/** Native observation/view bridge; sheep shaders, prey, dog identities and render-frame ordering stay G51. */
export interface PageCrowdViews {
  runtime: PreparedCrowds;
  factory: (options: FlockOpts, index: number) => Flock;
  advance: (view: Flock, index: number, speed: number, player: Vector3, dt: number, time: number, step: PreparedCrowds['advance']) => void;
}
const number = v.pipe(v.number(), v.finite());
const PageCrowdsSchema = v.strictObject({ slug: v.string(), hull: v.nullable(v.string()),
  bounds: v.tuple([number, number, number, number]),
  rows: v.array(FlockSchema), view: CrowdPresentationSchema,
  material: v.strictObject({ rim: number, bands: number }),
});
/** Client-only native crowd/view roster. All placement, bounds, materials and
 * hull identities are admitted rows; it borrows the installed terrain and
 * perception authorities without an author factory or frame callback. */
export function createPageCrowds(sky: SkyRig, seed: number, body: FlockBody, input: unknown, dogWolves: readonly Animal[] = []): PageCrowdViews {
  const data = v.parse(PageCrowdsSchema, input);
  const rows = data.rows.map(row => parseFlock({ ...row, seed: seed + row.seed }));
  if (data.bounds[0] >= data.bounds[1] || data.bounds[2] >= data.bounds[3]) throw new Error('Invalid crowd placement bounds');
  const views = new Map<string, Flock>(), observations = new Map<string, CrowdObservation>();
  const runtime = prepareDeclaredCrowds(rows, { flock: row => {
    const observation: CrowdObservation = { player: new Vector3(), playerSpeed: 0, wolves: dogWolves, dog: null };
    observations.set(row.id, observation);
    return { ports: { heightAt, normalY: (x, z) => normalAt(x, z)[1],
      inBounds: (x, z, margin) => x >= data.bounds[0] + margin && x <= data.bounds[1] - margin && z >= data.bounds[2] + margin && z <= data.bounds[3] - margin,
      wetAt: (x, z) => wildEnv.wetAt(x,z), playerCrouched: () => wildEnv.playerCrouched,
      grassHeightAt: (x, z) => wildEnv.grassHeightAt(x, z), trample: (...values) => { wildEnv.trample(...values); }, centre: () => undefined },
    observe: () => observation,
    sound: (cue, x, z) => { const view=views.get(row.id);if(view!==undefined)app.events.emit('creature.sound',{cue,x,y:heightAt(x,z),z}); },
    present: (_policy, time, moved) => {
      const view = views.get(row.id); if (view === undefined) throw new Error('Missing native crowd view');
      view.project(moved ? time : undefined);
    } };
  } });
  runtime.initialize();
  return { runtime, factory: (options, index) => {
    const row = rows[index], policy = row === undefined ? undefined : runtime.policies.get(row.id);
    if (row === undefined || policy === undefined || views.has(row.id) || row.x !== options.x || row.z !== options.z
      || row.count !== options.count || row.seed !== options.seed || row.range !== (options.range ?? 45)) throw new Error('Unbound native crowd roster');
    const view = new Flock(policy,body,painterlyMaterial(sky,data.material),data.view);
    if (data.hull !== null) productRiggedHulls(data.slug).load(data.hull).then(rig=>{view.useRig(rig);return null;}).catch((cause:unknown)=>{throw new Error('Crowd rig failed',{cause});});
    views.set(row.id, view); return view;
  }, advance: (view, index, speed, player, dt, time, step) => {
    const row = rows[index], observation = row === undefined ? undefined : observations.get(row.id);
    if (row === undefined || observation === undefined || views.get(row.id) !== view) throw new Error('Unbound native crowd view');
    observation.player = player; observation.playerSpeed = speed; observation.dog = view.dog;
    step(row.id, dt, time);
  } };
}
