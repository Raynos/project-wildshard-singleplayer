import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { PackPrey } from '@wildshard/engine/ai/pack';
import { FlockBrain, type FlockPorts, type FlockThreat, type FlockPose } from '@wildshard/engine/ai/flock';
import type { SimHost } from '@wildshard/engine/sim';
import type { LevelContext } from '@wildshard/engine/level/context';
import { Vector3 } from 'three';
import { parseFlock, type ShardFlock } from '@wildshard/format/crowds';

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

/** Stable prey identity reads and damages the authoritative crowd member. */
export class CrowdPrey {
  private readonly point = new Vector3();
  constructor(readonly flock: CrowdTargets, readonly index: number) {}
  get position(): Vector3 { return this.flock.positions(this.index, this.point); }
  get yaw(): number { return this.flock.headingOf(this.index); }
  get alive(): boolean { return this.flock.isAlive(this.index); }
  readonly applyDamage = (): boolean => { this.flock.kill(this.index); return true; };
}

/** Spatial and damage projection of an existing crowd owner. Rows specify local
 * hit spheres and the prey anchor; this host never advances flock decisions. */
export class CrowdTargets {
  readonly n: number;
  private readonly targetPose: FlockPose = { x: 0, y: 0, z: 0, yaw: 0, speed: 0, phase: 0, graze: 0, dead: false, deathTime: 0, scale: 1, wool: 0 };
  constructor(protected readonly controller: Pick<FlockBrain, 'n' | 'alive' | 'cx' | 'cz' | 'panicking' | 'readPose' | 'kill' | 'scare' | 'straggler' | 'nearest'>,
    private readonly targets: { readonly preyY: number; readonly hits: readonly (readonly number[])[] }) {
    if (!Number.isFinite(targets.preyY) || targets.hits.length === 0 || targets.hits.length > 16
      || targets.hits.some(row => row.length !== 3 || row.some(value => !Number.isFinite(value)) || (row[2] ?? 0) <= 0)) throw new Error('Invalid crowd target rows');
    this.n = controller.n;
  }
  get alive(): number { return this.controller.alive; }
  get cx(): number { return this.controller.cx; }
  get cz(): number { return this.controller.cz; }
  get panicking(): boolean { return this.controller.panicking; }
  positions(index: number, out: Vector3): Vector3 { const p = this.controller.readPose(index, this.targetPose); return out.set(p.x, p.y + this.targets.preyY, p.z); }
  headingOf(index: number): number { return this.controller.readPose(index, this.targetPose).yaw; }
  isAlive(index: number): boolean { return index >= 0 && index < this.n && !this.controller.readPose(index, this.targetPose).dead; }
  owns(prey: CrowdPrey): boolean { return prey.flock === this; }
  prey(index: number): CrowdPrey { if (!Number.isInteger(index) || index < 0 || index >= this.n) throw new RangeError('Unknown crowd member'); return new CrowdPrey(this, index); }
  nearest(x: number, z: number): number { return this.controller.nearest(x, z); }
  kill(index: number): void { this.controller.kill(index); }
  scare(x: number, z: number, seconds: number): void { this.controller.scare(x, z, seconds); }
  straggler(minimum = 12): number { return this.controller.straggler(minimum); }
  raycast(origin: Vector3, direction: Vector3, maximum: number): number {
    let best = maximum, member = -1;
    for (let index = 0; index < this.n; index++) {
      const p = this.controller.readPose(index, this.targetPose); if (p.dead) continue;
      for (const sphere of this.targets.hits) {
        const [offset, up, radius] = sphere; if (offset === undefined || up === undefined || radius === undefined) throw new Error('Missing target sphere');
        const ox = origin.x - p.x - Math.sin(p.yaw) * offset * p.scale;
        const oy = origin.y - p.y - up * p.scale;
        const oz = origin.z - p.z - Math.cos(p.yaw) * offset * p.scale;
        const b = ox * direction.x + oy * direction.y + oz * direction.z, c = ox * ox + oy * oy + oz * oz - (radius * p.scale) ** 2;
        const discriminant = b * b - c; if (discriminant < 0) continue;
        const entry = -b - Math.sqrt(discriminant), distance = entry >= 0 ? entry : c < 0 ? 0 : -1;
        if (distance >= 0 && distance < best) { best = distance; member = index; }
      }
    }
    return member;
  }
}

/** Native crowd/body identity joins and nearest ray selection over a live roster.
 * Crowds may be appended by their owner without replacing existing prey objects. */
export class CrowdRoster<T extends CrowdTargets> {
  private readonly preyBindings = new Map<string, PackPrey>();
  private readonly point = new Vector3();
  private hit: { flock: T; index: number; distance: number } | null = null;
  constructor(private readonly actors: readonly Animal[], private readonly crowds: readonly T[], private readonly prefix = 'crowd') {
    if (!/^[a-z][a-z0-9_.-]*$/u.test(prefix)) throw new Error('Invalid crowd identity prefix');
  }
  identity(prey: PackPrey): string {
    const actor = this.actors.find(value => value === prey);
    if (actor !== undefined) return `actor:${actor.entityId}`;
    if (!(prey instanceof CrowdPrey)) throw new Error('Unbound crowd prey');
    const index = this.crowds.findIndex(view => view.owns(prey));
    if (index === -1 || prey.index < 0 || prey.index >= prey.flock.n) throw new Error('Unbound crowd member');
    const id = `${this.prefix}:${index}:${prey.index}`; this.preyBindings.set(id, prey); return id;
  }
  resolve(id: string): PackPrey | null {
    if (id.startsWith('actor:')) return this.actors.find(actor => actor.entityId === id.slice(6)) ?? null;
    const existing = this.preyBindings.get(id); if (existing !== undefined) return existing;
    const match = id.startsWith(`${this.prefix}:`) ? /^(\d+):(\d+)$/u.exec(id.slice(this.prefix.length + 1)) : null; if (match === null) return null;
    const view = this.crowds[Number(match[1])], index = Number(match[2]);
    if (view === undefined || !Number.isSafeInteger(index) || index < 0 || index >= view.n) return null;
    const prey = view.prey(index); this.preyBindings.set(id, prey); return prey;
  }
  raycast(origin: Vector3, direction: Vector3, maximum: number): { flock: T; index: number; distance: number } | null {
    let best: { flock: T; index: number; distance: number } | null = null;
    for (const view of this.crowds) {
      const index = view.raycast(origin, direction, maximum); if (index < 0) continue;
      const distance = view.positions(index, this.point).distanceTo(origin);
      if (best === null || distance < best.distance) { best = this.hit ??= { flock: view, index, distance }; best.flock = view; best.index = index; best.distance = distance; }
    }
    return best;
  }
}
