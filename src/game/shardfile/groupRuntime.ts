import { PackBrain, type PackPorts, type PackContext } from '@wildshard/engine/ai/pack';
import { HerdBrain, type HerdPorts, type HerdContext } from '@wildshard/engine/ai/herd';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost } from '@wildshard/engine/sim';
import type { Rng, RngState } from '@wildshard/engine/core/rng';
import { parseGroupBrain, groupBrainRules, type ShardGroupBrain, type ShardPackGroup, type ShardHerdGroup } from './groupBrains';

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
function prepareRegistration(host: SimHost, group: ShardGroupBrain, members: AnimalSim[], ports: DeclaredGroupPorts): Registration {
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
  const groups = declarations.map(parseGroupBrain);
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
