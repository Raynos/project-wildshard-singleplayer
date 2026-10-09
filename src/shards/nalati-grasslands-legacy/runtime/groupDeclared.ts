import { PackBrain } from '@wildshard/engine/ai/pack';
import { HerdBrain } from '@wildshard/engine/ai/herd';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { groupBrain } from '@wildshard/sdk/groupBrains';
import { Pack, HorseHerd, type PackController, type PackPrey, type HerdController } from './groupRegistry';
import { nativePackPorts, nativeHerdPorts, PAGE_GROUP_WORLD, type NativeGroupHost } from './groupPorts';
import { NALATI_PACK_BRAIN, NALATI_HERD_BRAIN } from '../data/brains';

/** Stable native prey/actor identities for raid, flock and elite continuation; no invented guest control protocol. */
export interface NativeGroupIdentity {
  preyIdentity: (prey: PackPrey) => string;
  resolvePrey: (id: string) => PackPrey | null;
  resolveActor: (id: string) => Animal | null;
}
/** The existing AnimalManager schedules these controllers through its species callbacks. */
export interface NativeGroupFactories {
  pack: (members: Animal[], x: number, z: number) => PackController;
  herd: (members: Animal[]) => HerdController;
}
function declaredPack(members: Animal[], x: number, z: number, identity: NativeGroupIdentity, host: NativeGroupHost): PackBrain<Animal> {
    const data = groupBrain({ ...NALATI_PACK_BRAIN, home: [x, z], members: members.map(actor => actor.entityId) });
    if (data.kind !== 'pack') throw new Error('Invalid pack declaration');
    const policy = new PackBrain(members, x, z, data, { ...nativePackPorts(host, PAGE_GROUP_WORLD),
      preyIdentity: identity.preyIdentity, resolvePrey: identity.resolvePrey });
    policy.initialize(); Pack.register(policy); return policy;
}
function declaredHerd(members: Animal[], identity: NativeGroupIdentity, host: NativeGroupHost): HerdBrain<Animal> & HerdController {
    const data = groupBrain({ ...NALATI_HERD_BRAIN, members: members.map(actor => actor.entityId) });
    if (data.kind !== 'herd') throw new Error('Invalid herd declaration');
    const view: Pick<HerdController, 'findWolf'> = { findWolf: undefined };
    const policy = Object.assign(new HerdBrain(members, data, { ...nativeHerdPorts(host, PAGE_GROUP_WORLD), resolveActor: identity.resolveActor }), view);
    policy.findThreat = (x, z, radius) => policy.findWolf?.(x, z, radius) ?? null;
    const adopt = policy.adoptStallion.bind(policy);
    policy.adoptStallion = actor => { adopt(actor); HorseHerd.register(policy); };
    policy.initialize(); HorseHerd.register(policy); return policy;
}
/** Declared decisions reuse the shipping species, prey, mount, taming, shared-RNG and strike recipes through one registry. */
export function declaredGroupFactories(identity: NativeGroupIdentity, host: NativeGroupHost): NativeGroupFactories {
  return { pack: (members, x, z) => declaredPack(members, x, z, identity, host), herd: members => declaredHerd(members, identity, host) };
}

/** Manager-only fallback groups use actor prey identities; flock raids use Wildlife's full world ports. */
export function memberGroupIdentity(members: readonly Animal[]): NativeGroupIdentity {
  return {
    preyIdentity: prey => {
      const actor = members.find(member => member === prey);
      if (actor === undefined) throw new Error('Unbound fallback group prey');
      return `actor:${actor.entityId}`;
    },
    resolvePrey: id => members.find(actor => `actor:${actor.entityId}` === id) ?? null,
    resolveActor: id => members.find(actor => actor.entityId === id) ?? null,
  };
}
