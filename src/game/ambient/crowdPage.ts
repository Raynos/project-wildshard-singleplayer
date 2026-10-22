import type { ReturnProgram } from '../population/returnProgram';
import type { Rng } from '@wildshard/engine/core/rng';
import type { ThinkCtx } from '@wildshard/engine/entities/species/registry';
import { ANIMAL_STATES } from '@wildshard/engine/entities/AnimalSim';
import { CrowdPresentationSchema, CrowdGuardSchema } from '@wildshard/format/crowdPresentation';
import { FlockSchema, parseFlock } from '@wildshard/format/crowds';
import { app } from '@wildshard/engine/app/runtime';
import * as v from 'valibot';
import { readBakedGeometry, bakedGeometryBytes, type BakedGeometryRow } from '../plugin/geometry';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { prepareDeclaredCrowds, type PreparedCrowds, type CrowdObservation, type CrowdTargets } from '@wildshard/game/shardfile/crowdRuntime';
import { terrainHeight as heightAt, terrainNormal as normalAt } from '@wildshard/engine/world/terrainHeight';
import { Vector3 } from 'three';
import { CrowdDraw as Flock, type CrowdBody as FlockBody } from '@wildshard/game/ambient/crowdDraw';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import { productRiggedHulls } from '../looks/riggedHulls';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { wildEnv } from '@wildshard/game/population/pageGroups';

/** Admit the flock's exact static geometry and original seven shader pivots before any view builds. */
export async function readCrowdBody(product: Pick<ShardProduct, 'file' | 'json'>, files: { readonly json: string; readonly binary: string }): Promise<FlockBody> {
  const value = await product.json<{ row: BakedGeometryRow; pivots: FlockBody['pivots']; parts: FlockBody['parts']; radius: number }>(files.json);
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
  guardian: (actor: Animal, index: number, author: ReturnProgram, random: Rng) => void;
  runtime: PreparedCrowds;
  factory: (options: FlockOpts, index: number) => Flock;
  advance: (view: Flock, index: number, speed: number, player: Vector3, dt: number, time: number, step: PreparedCrowds['advance']) => void;
}
interface GuardBinding { readonly row: v.InferOutput<typeof CrowdGuardSchema>; readonly flock: CrowdTargets;
  readonly wolves: readonly Animal[]; readonly author: ReturnProgram; readonly random: Rng }
const guards = new WeakMap<Animal, GuardBinding>();
const stragglerPoint = new Vector3();

const number = v.pipe(v.number(), v.finite());
const PageCrowdsSchema = v.strictObject({ slug: v.string(), hull: v.nullable(v.string()),
  guard: v.optional(CrowdGuardSchema),
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
  if (data.guard?.states.some(state => !ANIMAL_STATES.some(value => value === state)) === true) throw new Error('Invalid crowd guardian states');
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
  return { runtime, guardian: (actor, index, author, random) => {
    const row = rows[index], view = row === undefined ? undefined : views.get(row.id);
    if (view === undefined || data.guard === undefined) throw new Error('Unbound crowd guardian');
    guards.set(actor, { row: data.guard, flock: view, wolves: dogWolves, author, random });
  }, factory: (options, index) => {
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

/** Native species slot over a bound crowd; authored decisions stay in its guest. */
export function thinkCrowdGuard(actor: Animal, context: ThinkCtx): void {
  const bound = guards.get(actor);
  if (bound === undefined || !actor.alive) { actor.setMotion(actor.yaw, 0, 1); return; }
  const { row, flock, author } = bound, point = actor.position, memory = actor.mem;
  const previous = memory[row.clock], dt = previous === undefined ? context.dt : context.t - previous;
  if (previous !== undefined && dt < row.every - 1e-9) return;
  let threat: Animal | null = null, distance = Infinity;
  for (const candidate of bound.wolves) {
    const d = Math.hypot(candidate.position.x - flock.cx, candidate.position.z - flock.cz);
    if (candidate.alive && d < distance) { threat = candidate; distance = d; }
  }
  const straggler = flock.straggler(row.straggler); if (straggler >= 0) flock.positions(straggler, stragglerPoint);
  const answer = author.project(row.signal, { px: point.x, py: point.y, pz: point.z, cx: flock.cx, cz: flock.cz, dt,
    bark: memory[row.memory.bark] ?? 0, rest: memory[row.memory.rest] ?? 0, wolf: Number(threat !== null), distance: threat === null ? 0 : distance,
    wx: threat?.position.x ?? 0, wy: threat?.position.y ?? 0, wz: threat?.position.z ?? 0,
    straggler: Number(straggler >= 0), sx: stragglerPoint.x, sy: stragglerPoint.y, sz: stragglerPoint.z,
    playerX: context.player.x, playerY: context.player.y, playerZ: context.player.z }, bound.random);
  const out = (key: string): number => { const value = answer[key]; if (value === undefined) throw new Error('Missing crowd guardian output'); return value; };
  memory[row.clock] = context.t; memory[row.memory.bark] = out('bark'); memory[row.memory.snarl] = out('snarl'); memory[row.memory.low] = out('low');
  if (answer['rest'] !== undefined) memory[row.memory.rest] = out('rest');
  const state = ANIMAL_STATES.find(value => value === row.states[out('state')]); if (state === undefined) throw new Error('Invalid crowd guardian state');
  actor.state = state; actor.lookTarget.set(out('lookX'), out('lookY'), out('lookZ')); actor.lookWeight = out('look');
  const path = out('path'), yaw = path > 0 ? context.pathYaw(actor, out('x'), out('z'), path) : out('yaw');
  if (path < 0) actor.setMotion(yaw, out('speed'), out('turn')); else context.steer(actor, yaw, out('speed'), out('turn'));
  if (out('emit') !== 0) app.events.emit('creature.sound', { cue: row.bark, x: point.x, y: heightAt(point.x, point.z) + row.soundHeight, z: point.z });
  context.confine(actor);
}
