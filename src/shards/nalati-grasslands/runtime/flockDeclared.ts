import { prepareDeclaredCrowds, type PreparedCrowds, type CrowdObservation } from '@wildshard/game/shardfile/crowdRuntime';
import { terrainHeight as heightAt, terrainNormal as normalAt } from '@wildshard/engine/world/terrainHeight';
import { Vector3 } from 'three';
import { Flock, type FlockOpts, dogWolves } from '../creatures/flock';
import type { WildlifeOpts } from '../creatures/wildlife';
import { NALATI_WILDLIFE } from '../creatures/wildPlacement';
import { wildEnv } from '../creatures/env';
import { nalatiFlockRows } from '../creatures/flockRows';

/** Native observation/view bridge; sheep shaders, prey, dog identities and render-frame ordering stay G51. */
export interface NativeFlocks {
  runtime: PreparedCrowds;
  factory: (options: FlockOpts, index: number) => Flock;
  advance: (view: Flock, index: number, speed: number, player: Vector3, dt: number, time: number, step: PreparedCrowds['advance']) => void;
}
/** Admit all authored crowds before placement; no legacy flock setup or scheduler runs in the declared branch. */
export function createNativeFlocks(sky: WildlifeOpts['sky'], seed: number, layout = NALATI_WILDLIFE.flocks): NativeFlocks {
  const rows = nalatiFlockRows(seed, layout);
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
    const view = new Flock(sky, options, policy).build(); views.set(row.id, view); return view;
  }, advance: (view, index, speed, player, dt, time, step) => {
    const row = rows[index], observation = row === undefined ? undefined : observations.get(row.id);
    if (row === undefined || observation === undefined || views.get(row.id) !== view) throw new Error('Unbound native flock view');
    observation.player = player; observation.playerSpeed = speed; observation.dog = view.dog;
    step(row.id, dt, time);
  } };
}
