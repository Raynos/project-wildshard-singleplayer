import { FlockBrain, type FlockPorts, type FlockThreat } from '@wildshard/engine/ai/flock';
import type { SimHost } from '@wildshard/engine/sim';
import type { LevelContext } from '@wildshard/engine/level/context';
import type { Vector3 } from 'three';
import { parseFlock, type ShardFlock } from './crowds';

/** Trusted perception sampled in the owning clock; threat identities remain native references. */
export interface CrowdObservation {
  player: Vector3; playerSpeed: number; wolves: readonly FlockThreat[]; dog: FlockThreat | null;
}
/** Terrain, perception and native presentation; construction must not draw randomness or mutate a view. */
export interface DeclaredCrowdRecipe {
  ports: FlockPorts;
  observe: () => CrowdObservation;
  sound?: (cue: string, x: number, z: number) => void;
  present?: (policy: FlockBrain, time: number, bodyAdvanced: boolean) => void;
}
/** Native crowd recipes resolved only after every declaration has passed admission. */
export interface DeclaredCrowdPorts { flock: (row: ShardFlock) => DeclaredCrowdRecipe }
/** Pure preparation, explicit setup and either a simulation clock or a transitional native frame clock. */
export interface PreparedCrowds {
  readonly policies: ReadonlyMap<string, FlockBrain>;
  initialize: (restoring?: boolean) => void;
  advance: (id: string, dt: number, time: number) => void;
  install: (host: SimHost, restoring?: boolean) => ReadonlyMap<string, FlockBrain>;
}
interface Registration { id: string; policy: FlockBrain; recipe: DeclaredCrowdRecipe }
const portFunctions = ['heightAt', 'normalY', 'inBounds', 'wetAt', 'playerCrouched', 'grassHeightAt', 'trample', 'centre'] as const;
function available(host: SimHost, rows: readonly Registration[]): void {
  if (host.scope.disposed || rows.some(row => host.hasStep(`crowd.${row.id}`) || host.adapters.has(`crowd.${row.id}`))) throw new Error('Installed or disposed crowd owner');
}

/** Validate every row and recipe before setup. An aborted setup restores every private RNG and ordered member state. */
export function prepareDeclaredCrowds(declarations: readonly ShardFlock[], ports: DeclaredCrowdPorts): PreparedCrowds {
  const rows = declarations.map(parseFlock);
  if (rows.length > 64 || new Set(rows.map(row => row.id)).size !== rows.length
    || rows.reduce((sum, row) => sum + row.count, 0) > 4096 || typeof ports.flock !== 'function') throw new Error('Invalid crowd declarations or port');
  const recipes = rows.map(row => ports.flock(row));
  for (const recipe of recipes) {
    if (portFunctions.some(key => typeof recipe.ports[key] !== 'function') || typeof recipe.observe !== 'function'
      || (recipe.sound !== undefined && typeof recipe.sound !== 'function') || (recipe.present !== undefined && typeof recipe.present !== 'function')) throw new Error('Missing declared crowd recipe');
  }
  const registrations = rows.map((row, index): Registration => {
    const recipe = recipes[index];
    if (recipe === undefined) throw new Error('Missing crowd recipe');
    const policy = new FlockBrain(recipe.ports, row);
    if (recipe.sound !== undefined) policy.onSound = recipe.sound;
    return { id: row.id, policy, recipe };
  });
  const policies = new Map(registrations.map(row => [row.id, row.policy]));
  const byId = new Map(registrations.map(row => [row.id, row]));
  let initialized = false, installed = false;
  const initialize = (restoring = false): void => {
    if (initialized) throw new Error('Crowds already initialized');
    const states = registrations.map(row => row.policy.snapshot());
    try {
      if (!restoring) for (const row of registrations) row.policy.initialize();
      initialized = true;
    } catch (error) {
      for (const [index, row] of registrations.entries()) {
        const saved = states[index]; if (saved !== undefined) row.policy.restore(saved);
      }
      throw error;
    }
  };
  const advance = (id: string, dt: number, time: number): void => {
    if (!initialized) throw new Error('Crowds not initialized');
    const row = byId.get(id);
    if (row === undefined) throw new Error('Unknown crowd');
    const observations = row.recipe.observe();
    row.policy.dog = observations.dog;
    const moved = row.policy.update(dt, time, observations.player, observations.playerSpeed, observations.wolves);
    row.recipe.present?.(row.policy, time, moved);
  };
  return { policies, initialize, advance, install: (host, restoring = false) => {
    if (installed || initialized) throw new Error('Crowds already initialized or installed');
    available(host, registrations);
    const states = registrations.map(row => row.policy.snapshot()), undo: (() => void)[] = [];
    try {
      initialize(restoring);
      for (const row of registrations) undo.push(host.onStep(`crowd.${row.id}`, dt => { advance(row.id, dt, host.clock.now); }, {
        snapshot: () => row.policy.snapshot(), restore: saved => {
          if (typeof saved !== 'string') throw new Error('Invalid crowd continuation');
          row.policy.restore(saved);
        },
      }));
      installed = true; return policies;
    } catch (error) {
      for (const remove of undo) remove();
      for (const [index, row] of registrations.entries()) { const saved = states[index]; if (saved !== undefined) row.policy.restore(saved); }
      initialized = false; throw error;
    }
  } };
}

/** G51 frame adapter: the native recipe retains its shipping observation/view order and rendered dt until conversion. */
export interface CrowdFrameInstallation {
  systemId: string; after: readonly string[]; before: readonly string[];
  current: () => PreparedCrowds | null;
  frame: (dt: number, time: number, advance: PreparedCrowds['advance']) => void;
}
/** Own the transitional update slot; the native frame recipe calls each declared crowd exactly once in shipping order. */
export function installDeclaredCrowdFrames(context: Pick<LevelContext, 'system'>, options: CrowdFrameInstallation): void {
  context.system({ id: options.systemId, phase: 'update', after: [...options.after], before: [...options.before], run: (dt, time) => {
    const runtime = options.current();
    const visited = new Set<string>();
    options.frame(dt, time, (id, frameDt, frameTime) => {
      if (runtime === null || visited.has(id) || frameDt !== dt || frameTime !== time) throw new Error('Invalid native crowd clock or duplicate advance');
      visited.add(id); runtime.advance(id, frameDt, frameTime);
    });
    if (runtime !== null && visited.size !== runtime.policies.size) throw new Error('Incomplete native crowd frame');
  } });
}
