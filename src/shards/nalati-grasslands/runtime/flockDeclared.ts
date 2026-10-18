import ecology from '../data/ecology.generated.json' with { type: 'json' };
import * as v from 'valibot';
import { readBakedGeometry, bakedGeometryBytes } from '@wildshard/sdk/kit/bakedGeometry';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { prepareDeclaredCrowds, type PreparedCrowds, type CrowdObservation } from '@wildshard/game/shardfile/crowdRuntime';
import { terrainHeight as heightAt, terrainNormal as normalAt } from '@wildshard/engine/world/terrainHeight';
import { Vector3 } from 'three';
import { Flock, type FlockOpts, type FlockBody, dogWolves } from '../creatures/flock';
import type { WildlifeOpts } from '../creatures/wildlife';
import { wildEnv } from '../creatures/env';
import { parseFlock } from '@wildshard/format/crowds';

/** Admit the flock's exact static geometry and original seven shader pivots before any view builds. */
export async function readFlockBody(product: Pick<ShardProduct, 'file'>): Promise<FlockBody> {
  const number = v.pipe(v.number(), v.finite()), whole = v.pipe(number, v.integer(), v.minValue(0));
  const value = v.parse(v.strictObject({ row: v.strictObject({
    attrs: v.array(v.tuple([v.string(), v.literal('f32'), whole, v.boolean()])), count: whole,
    index: v.nullable(v.picklist(['u16', 'u32'])), indexCount: whole, box: v.boolean() }),
    pivots: v.pipe(v.array(v.tuple([number, number, number])), v.length(7)),
    parts: v.pipe(v.array(v.string()), v.length(7)), radius: number,
  }), JSON.parse(new TextDecoder().decode(await product.file('actors/sheep.json'))));
  const bytes = await product.file('actors/sheep.bin');
  if (bytes.length !== bakedGeometryBytes(value.row)) throw new Error('Sheep geometry differs from its declared blocks');
  const geometry = readBakedGeometry(bytes, 0, value.row);
  if (geometry.boundingSphere === null) throw new Error('Sheep geometry has no bounds');
  geometry.boundingSphere.radius = value.radius;
  return { geometry, pivots: value.pivots, parts: value.parts };
}

/** Native observation/view bridge; sheep shaders, prey, dog identities and render-frame ordering stay G51. */
export interface NativeFlocks {
  runtime: PreparedCrowds;
  factory: (options: FlockOpts, index: number) => Flock;
  advance: (view: Flock, index: number, speed: number, player: Vector3, dt: number, time: number, step: PreparedCrowds['advance']) => void;
}
/** Admit all authored crowds before placement; no legacy flock setup or scheduler runs in the declared branch. */
export function createNativeFlocks(sky: WildlifeOpts['sky'], seed: number, body: FlockBody, profile: keyof typeof ecology.flocks = 'world'): NativeFlocks {
  const rows = ecology.flocks[profile].map(row => parseFlock({ ...row, seed: seed + row.seed }));
  const views = new Map<string, Flock>(), observations = new Map<string, CrowdObservation>();
  const runtime = prepareDeclaredCrowds(rows, { flock: row => {
    const observation: CrowdObservation = { player: new Vector3(), playerSpeed: 0, wolves: dogWolves, dog: null };
    observations.set(row.id, observation);
    return { ports: { heightAt, normalY: (x, z) => normalAt(x, z)[1],
      inBounds: (x, z, margin) => Math.abs(x) <= 250 - margin && Math.abs(z) <= 250 - margin,
      wetAt: (x, z) => wildEnv.wetAt?.(x, z) ?? false, playerCrouched: () => wildEnv.playerCrouched,
      grassHeightAt: (x, z) => wildEnv.grassHeightAt(x, z), trample: (...values) => { wildEnv.trample(...values); }, centre: () => undefined },
    observe: () => observation,
    sound: (cue, x, z) => { views.get(row.id)?.onSound?.(cue, x, z); },
    present: (_policy, time, moved) => {
      const view = views.get(row.id); if (view === undefined) throw new Error('Missing native flock view');
      view.project(moved ? time : undefined);
    } };
  } });
  runtime.initialize();
  return { runtime, factory: (options, index) => {
    const row = rows[index], policy = row === undefined ? undefined : runtime.policies.get(row.id);
    if (row === undefined || policy === undefined || views.has(row.id) || row.x !== options.x || row.z !== options.z
      || row.count !== options.count || row.seed !== options.seed || row.range !== (options.range ?? 45)) throw new Error('Unbound native flock roster');
    const view = new Flock(sky, options, body, policy).build(); views.set(row.id, view); return view;
  }, advance: (view, index, speed, player, dt, time, step) => {
    const row = rows[index], observation = row === undefined ? undefined : observations.get(row.id);
    if (row === undefined || observation === undefined || views.get(row.id) !== view) throw new Error('Unbound native flock view');
    observation.player = player; observation.playerSpeed = speed; observation.dog = view.dog;
    step(row.id, dt, time);
  } };
}
