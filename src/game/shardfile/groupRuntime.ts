import { NativeWildEnvironment } from '../population/nativeManager';
import { Vector3 } from 'three';
import type { FlockBrain } from '@wildshard/engine/ai/flock';
import { PackBrain, type PackPorts, type PackContext, type PackPrey } from '@wildshard/engine/ai/pack';
import { HerdBrain, type HerdPorts, type HerdContext } from '@wildshard/engine/ai/herd';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost } from '@wildshard/engine/sim';
import type { Rng, RngState } from '@wildshard/engine/core/rng';
import { nativeGroupBrain, groupBrainRules, type ShardGroupBrain, type ShardPackGroup, type ShardHerdGroup } from '@wildshard/format/groupBrains';

/** One group continuation; actor memory, motors and random streams remain with the simulation owner. */
export type DeclaredGroupPolicy = PackBrain<AnimalSim> | HerdBrain<AnimalSim>;
/** Trusted pack perception, prey/contact identities and per-actor steering observations. Recipe construction is pure. */
export interface DeclaredPackRecipe {
  ports: PackPorts<AnimalSim>;
  observe: (actor: AnimalSim, dt: number) => PackContext<AnimalSim>;
  confine: (actor: AnimalSim) => void;
}
/** Trusted herd perception, taming/contact identities and per-actor steering observations. Recipe construction is pure. */
export interface DeclaredHerdRecipe {
  ports: HerdPorts<AnimalSim>;
  observe: (actor: AnimalSim, dt: number) => HerdContext<AnimalSim>;
}
/** Native recipes for declared groups; no author callback receives the world or chooses an actor binding. */
export interface DeclaredGroupPorts {
  pack?: (group: ShardPackGroup, members: readonly AnimalSim[], host: SimHost) => DeclaredPackRecipe;
  herd?: (group: ShardHerdGroup, members: readonly AnimalSim[], host: SimHost) => DeclaredHerdRecipe;
}
/** Pure preparation lets a loader preflight its other controllers before initialization and callback registration. */
export interface PreparedGroupBrains {
  readonly policies: ReadonlyMap<string, DeclaredGroupPolicy>;
  install: (restoring?: boolean) => ReadonlyMap<string, DeclaredGroupPolicy>;
}
interface Registration {
  id: string; members: AnimalSim[]; policy: DeclaredGroupPolicy;
  random: () => Rng; run: (dt: number) => void;
}
const commonFunctions = ['sharedRng', 'environment', 'visibility', 'hearing', 'downwind', 'inBounds', 'normalY'] as const;
function functionsPresent(values: readonly unknown[]): void {
  if (values.some(value => typeof value !== 'function')) throw new Error('Missing declared group recipe');
}
function available(host: SimHost, registrations: readonly Registration[]): void {
  for (const row of registrations) {
    if (host.hasStep(row.id) || host.adapters.has(row.id) || row.members.some(actor => host.entities.get(actor.entityId) !== actor
      || host.hasStep(`brain.${actor.entityId}`) || host.adapters.has(`brain.${actor.entityId}`))) throw new Error('Installed or changed group controller');
  }
}
function prepareRegistration(host: SimHost, group: ShardPackGroup | ShardHerdGroup, members: AnimalSim[], ports: DeclaredGroupPorts): Registration {
    const id = `group.${group.id}`;
    if (group.kind === 'pack') {
      if (ports.pack === undefined) throw new Error('Missing declared group port');
      const recipe = ports.pack(group, members, host);
      functionsPresent([...commonFunctions.map(key => recipe.ports[key]), recipe.ports.register, recipe.ports.bite,
        recipe.ports.preyIdentity, recipe.ports.resolvePrey, recipe.observe, recipe.confine]);
      const policyForGroup = new PackBrain(members, group.home[0], group.home[1], group, recipe.ports);
      return { id, members, policy: policyForGroup, random: recipe.ports.sharedRng, run: dt => {
        if (host.state.tick % group.thinkDivisor === 0) for (const actor of members) if (actor.alive) {
          const context = { ...recipe.observe(actor, group.thinkDivisor / 60), dt: group.thinkDivisor / 60, t: host.clock.now };
          policyForGroup.tick(context); policyForGroup.drive(actor, context); recipe.confine(actor);
        }
        for (const actor of members) if (actor.alive) {
          policyForGroup.drive(actor, { ...recipe.observe(actor, dt), dt, t: host.clock.now }, true); recipe.confine(actor);
        }
      } };
    }
    {
      if (ports.herd === undefined) throw new Error('Missing declared group port');
      const recipe = ports.herd(group, members, host);
      functionsPresent([...commonFunctions.map(key => recipe.ports[key]), recipe.ports.passThrough, recipe.ports.chargeContact,
        recipe.ports.scarePack, recipe.ports.resolveActor, recipe.observe]);
      const policyForGroup = new HerdBrain(members, group, recipe.ports);
      return { id, members, policy: policyForGroup, random: recipe.ports.sharedRng, run: dt => {
        if (host.state.tick % group.thinkDivisor === 0) for (const actor of members) if (actor.alive) {
          const context = { ...recipe.observe(actor, group.thinkDivisor / 60), dt: group.thinkDivisor / 60, t: host.clock.now };
          policyForGroup.tick(context); policyForGroup.drive(actor, context);
        }
        for (const actor of members) if (actor.alive) policyForGroup.drive(actor, { ...recipe.observe(actor, dt), dt, t: host.clock.now }, true);
      } };
    }
}
/** Validate every roster and recipe without draws, memory writes or registration. Install after all controller preflight; restore skips setup. */
export function prepareDeclaredGroupBrains(host: SimHost, declarations: readonly ShardGroupBrain[],
  spawns: readonly { id: string; brain: string | null }[], ports: DeclaredGroupPorts,
  individualIds: readonly string[] = [], encounterIds: readonly string[] = []): PreparedGroupBrains {
  const groups = declarations.map(nativeGroupBrain);
  if (new Set(spawns.map(row => row.id)).size !== spawns.length || groupBrainRules(groups, spawns, individualIds, encounterIds).length > 0) throw new Error('Invalid group controller roster');
  for (const group of groups) {
    if (host.hasStep(`group.${group.id}`) || host.adapters.has(`group.${group.id}`) || group.members.some(id => id === host.player.id || host.entities.get(id)?.entityId !== id
      || host.hasStep(`brain.${id}`) || host.adapters.has(`brain.${id}`))) throw new Error('Unresolved or installed group actor');
    if ((group.kind === 'pack' && ports.pack === undefined) || (group.kind === 'herd' && ports.herd === undefined)) throw new Error('Missing declared group port');
  }
  const registrations: Registration[] = [], policies = new Map<string, DeclaredGroupPolicy>();
  for (const group of groups) {
    const members = group.members.map(id => {
      const actor = host.entities.get(id);
      if (actor === undefined) throw new Error('Unresolved group actor');
      return actor;
    });
    const registration = prepareRegistration(host, group, members, ports);
    registrations.push(registration); policies.set(group.id, registration.policy);
  }
  available(host, registrations);
  let installed = false;
  return { policies, install: (restoring = false) => {
    if (installed) throw new Error('Group controllers already installed');
    available(host, registrations);
    const memories = registrations.flatMap(row => row.members.map(actor => ({ actor, memory: { ...actor.mem } })));
    const states = registrations.map(row => row.policy.snapshot()), streams = host.rng.snapshot();
    const random = new Map<Rng, RngState>(), remove: (() => void)[] = [];
    try {
      if (!restoring) for (const row of registrations) {
        const rng = row.random(); if (!random.has(rng)) random.set(rng, rng.snapshot());
        row.policy.initialize();
      }
      for (const row of registrations) remove.push(host.onStep(row.id, row.run, {
        snapshot: () => row.policy.snapshot(), restore: saved => {
          if (typeof saved !== 'string') throw new Error('Invalid group continuation');
          row.policy.restore(saved);
        },
      }));
      installed = true; return policies;
    } catch (error) {
      for (const undo of remove) undo();
      for (const { actor, memory } of memories) { for (const key of Object.keys(actor.mem)) delete actor.mem[key]; Object.assign(actor.mem, memory); }
      for (const [rng, state] of random) rng.restore(state);
      host.rng.restore(streams);
      for (const [index, row] of registrations.entries()) { const state = states[index]; if (state !== undefined) row.policy.restore(state); }
      throw error;
    }
  } };
}

// Built-in controllers are trusted services, never author-provided port objects.
const nativeHerdCollections = new WeakMap<SimHost, Map<string, { herds: readonly HerdBrain<AnimalSim>[]; wind: { x: number; z: number; strength: number } }>>();
/** Publish native herd controllers under a stable service identity. */
export function admitNativeHerds(host: SimHost, id: string, herds: readonly HerdBrain<AnimalSim>[], wind?: { x: number; z: number; strength: number }): void {
  const services = nativeHerdCollections.get(host) ?? new Map<string, { herds: readonly HerdBrain<AnimalSim>[]; wind: { x: number; z: number; strength: number } }>();
  if (services.has(id) || herds.length > 8 || herds.some(herd => !(herd instanceof HerdBrain))) throw new Error('Invalid native herd collection');
  services.set(id, { herds, wind: wind ?? { x: 0, z: 0, strength: 0 } }); nativeHerdCollections.set(host, services);
  host.scope.onDispose(() => { services.delete(id); });
}
/** Resolve the built-in herd owner for a data-only feature install. */
export function nativeHerds(host: SimHost, id: string): readonly HerdBrain<AnimalSim>[] {
  const herds = nativeHerdCollections.get(host)?.get(id); if (herds === undefined) throw new Error('Missing native herd collection'); return herds.herds;
}

/** Shared numeric wind observation; no world or weather callback is retained. */
export function nativeHerdWind(host: SimHost, id: string): { x: number; z: number; strength: number } {
  const rows = nativeHerdCollections.get(host)?.get(id); if (rows === undefined) throw new Error('Missing native herd wind'); return rows.wind;
}

const collections = new WeakMap<SimHost, Map<string, NativeGroupCollection>>();
/** Existing native group service, resolved by stable data id. */
export function nativeGroupCollection(host: SimHost, id: string): NativeGroupCollection {
  const owner = collections.get(host)?.get(id); if (owner === undefined) throw new Error('Missing native group collection'); return owner;
}
/** Native identity books and actual group owners. Deferred membership and crowd
 * prey use these same maps, never a shard resolver or pack-factory callback. */
export class NativeGroupCollection {
  private preyRows: PackPrey[][] = [];
  readonly environment: NativeWildEnvironment | undefined;
  constructor(private readonly host: SimHost, readonly packs: PackBrain<AnimalSim>[], readonly herds: HerdBrain<AnimalSim>[],
    private readonly actors: Map<string, AnimalSim>, private readonly prey: Map<string, PackPrey>, private readonly ids: WeakMap<PackPrey, string>,
    private readonly wolves: AnimalSim[], private readonly packOf: WeakMap<AnimalSim, PackBrain<AnimalSim>>,
    rows: { id: string; firstRaid: number; environment?: NativeWildEnvironment }) {
    const map = collections.get(host) ?? new Map<string, NativeGroupCollection>();
    if (rows.environment !== undefined && !(rows.environment instanceof NativeWildEnvironment)) throw new Error('Invalid native group world');
    if (map.has(rows.id) || packs.length === 0 || packs.length > 8 || herds.length > 8 || packs.some(pack => !(pack instanceof PackBrain))
      || herds.some(herd => !(herd instanceof HerdBrain)) || [...actors.values()].some(actor => host.entities.get(actor.entityId) !== actor)) throw new Error('Invalid native group owners');
    map.set(rows.id, this); collections.set(host, map); host.scope.onDispose(() => { map.delete(rows.id); }); this.firstRaid = rows.firstRaid; this.environment = rows.environment;
  }
  readonly firstRaid: number;
  addPack(members: AnimalSim[], x: number, z: number): PackBrain<AnimalSim> {
    const source = this.packs[0]; if (source === undefined || this.packs.length >= 8 || members.length > 64 || members.some(actor => this.host.entities.get(actor.entityId) !== actor)) throw new Error('Invalid deferred native pack');
    for (const actor of members) { this.actors.set(actor.entityId, actor); this.ids.set(actor, `actor:${actor.entityId}`); this.wolves.push(actor); }
    const pack = source.sibling(members, x, z);
    pack.findPrey = (px, pz, radius) => {
      let selected: AnimalSim | null = null, best = radius;
      for (const herd of this.herds) for (const actor of herd.foals) { const distance = Math.hypot(actor.position.x-px,actor.position.z-pz); if (actor.alive && distance < best) { selected = actor; best = distance; } }
      return selected;
    };
    this.packs.push(pack); for (const actor of members) this.packOf.set(actor, pack); return pack;
  }
  bindFlocks(flocks: readonly FlockBrain[], prefix: string): readonly (readonly PackPrey[])[] {
    if (this.preyRows.length > 0 || flocks.length > 4) throw new Error('Invalid native flock binding');
    this.preyRows = flocks.map((flock, index) => Array.from({ length: flock.n }, (_, at) => {
      const position = new Vector3(), id = `${prefix}${String(index)}:${String(at)}`;
      if (this.prey.has(id)) throw new Error('Duplicate native flock prey');
      const prey = { get position() { return flock.positions(at, position); }, get yaw() { return flock.headingOf(at); }, get alive() { return flock.isAlive(at); },
        applyDamage: (): boolean => { flock.kill(at); return true; } };
      this.prey.set(id, prey); this.ids.set(prey, id); return prey;
    })); return this.preyRows;
  }
}
