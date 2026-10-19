import { PackBrain, type PackPrey } from '@wildshard/engine/ai/pack';
import { HerdBrain } from '@wildshard/engine/ai/herd';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { nativeGroupBrain } from '@wildshard/format/groupBrains';
import { nativePackPorts, nativeHerdPorts, type NativeGroupHost, type NativeGroupWorld } from './groupPorts';
import brainRows from '../data/brains.json' with { type: 'json' };

/** Bind stable native identities and ports to the existing engine group owners. */
export function declaredGroupFactories<A extends AnimalSim>(identity: {
  preyIdentity: (prey: PackPrey) => string; resolvePrey: (id: string) => PackPrey | null; resolveActor: (id: string) => A | null;
}, host: NativeGroupHost<A>, world: NativeGroupWorld<A>): { pack: (members: A[], x: number, z: number) => PackBrain<A>; herd: (members: A[]) => HerdBrain<A> } {
  return {
    pack: (members: A[], x: number, z: number): PackBrain<A> => {
      const row = nativeGroupBrain({ ...brainRows.pack, home: [x, z], members: members.map(a => a.entityId) });
      if (row.kind !== 'pack') throw new Error('Invalid pack declaration');
      const policy = new PackBrain(members, x, z, row, { ...nativePackPorts(host, world), preyIdentity: identity.preyIdentity, resolvePrey: identity.resolvePrey });
      policy.initialize(); return policy;
    },
    herd: (members: A[]): HerdBrain<A> => {
      const row = nativeGroupBrain({ ...brainRows.herd, members: members.map(a => a.entityId) });
      if (row.kind !== 'herd') throw new Error('Invalid herd declaration');
      const policy = new HerdBrain(members, row, { ...nativeHerdPorts(host, world), resolveActor: identity.resolveActor });
      policy.initialize(); return policy;
    },
  };
}
