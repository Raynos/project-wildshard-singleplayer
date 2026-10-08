import type { ShardContext } from '@wildshard/game/shard/context';
import { bindRuntimeHomes, type RuntimeHome } from '@wildshard/game/shardfile/hybridRows';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { lastLightAll } from '../look/light';
import source from '../shard.config';

/**
 * The dune's creatures (C2): its shardfile's declared homes (`runtime.spawns`, data/spawns.ts), kept by the platform
 * (`bindRuntimeHomes`: respawn, retained identities). The runtime dresses each body in the bible's rim and cool floor
 * (round 1, R1C-2), and `held` keeps the ray circling its home without striking (round 1, R1B-13: the player arrived hurt
 * before meeting Sefa).
 */
export function installCreatures(ctx: ShardContext, held: () => boolean = () => false): { homes: readonly RuntimeHome[]; ray: () => Animal | null; all: () => Animal[] } {
  const kept = bindRuntimeHomes(ctx, source, { system: 'sunscar.creatures', spawned: (animal) => { lastLightAll(animal.mesh, ctx.scope); } });
  const ray = (): Animal | null => kept.homes[0]?.animal ?? null;
  ctx.system({ id: 'sunscar.ray', phase: 'update', run: () => { const body = ray(); if (body) body.mem['held'] = held() ? 1 : 0; } });
  return { homes: kept.homes, ray, all: kept.all };
}
