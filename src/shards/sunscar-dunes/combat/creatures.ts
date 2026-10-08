import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { ShardContext } from '@wildshard/game/shard/context';
import { retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import { PACKS, RAY_HOME, STRIDERS } from '../layout';
import { lastLightAll } from '../look/light';

/** Seconds after a creature falls before its home spawns it again. */
export const RESPAWN = { duneRay: 25, sandSkitterer: 50, duneStrider: 70 } as const;

interface Home { kind: keyof typeof RESPAWN; x: number; z: number; yaw: number; animal: Animal | null; wait: number }

/**
 * The dune's creatures (C2): one dune ray over the spawn crests, three skitterer packs burrowed along the paths, two
 * striders grazing the far flats. Each home holds one creature and refills `RESPAWN` seconds after it dies. `held`
 * keeps the ray circling its home without striking (round 1, R1B-13: the player arrived hurt before meeting Sefa).
 */
export function installCreatures(ctx: ShardContext, held: () => boolean = () => false): { homes: readonly Home[]; ray: () => Animal | null; all: () => Animal[] } {
  const animals = ctx.game.runtime?.play?.animals;
  const retained = retainsRuntimeServices(ctx);
  const homes: Home[] = [{ kind: 'duneRay', x: RAY_HOME.x, z: RAY_HOME.z, yaw: 0, animal: null, wait: 0 }];
  for (const p of PACKS) for (let i = 0; i < p.n; i++) {
    const a = (i / p.n) * Math.PI * 2 + p.x * 0.1;
    homes.push({ kind: 'sandSkitterer', x: p.x + Math.sin(a) * 3.5, z: p.z + Math.cos(a) * 3.5, yaw: a, animal: null, wait: 0 });
  }
  for (const s of STRIDERS) homes.push({ kind: 'duneStrider', x: s.x, z: s.z, yaw: 0, animal: null, wait: 0 });
  const spawn = (home: Home): void => {
    home.animal = retained && home.animal !== null
      ? animals?.replace(home.animal, home.x, home.z, home.yaw, 'dusk', {}) ?? null
      : animals?.spawn(home.kind, home.x, home.z, home.yaw, 'dusk', retained ? { entityId: `sunscar.home:${String(homes.indexOf(home))}` } : undefined) ?? null;
    home.wait = 0;
    if (home.animal) lastLightAll(home.animal.mesh, ctx.scope); // the bible's rim and cool floor (round 1, R1C-2)
  };
  for (const home of homes) spawn(home);
  ctx.on('actor.died', ({ actor }) => {
    const home = homes.find((h) => h.animal?.combatActor() === actor); if (home) home.wait = RESPAWN[home.kind];
  });
  ctx.system({ id: 'sunscar.creatures', phase: 'update', run: (dt) => {
    const ray = homes[0]?.animal; if (ray) ray.mem['held'] = held() ? 1 : 0;
    for (const home of homes) {
      // A portable cold restore can reapply a dead body without replaying its death event.
      if (retained && home.animal?.alive === false && home.wait <= 0) home.wait = RESPAWN[home.kind];
      if (home.wait <= 0) continue;
      home.wait -= dt;
      if (home.wait <= 0) { if (home.animal) animals?.retire(home.animal); spawn(home); }
    }
  } });
  ctx.scope.onDispose(() => { for (const home of homes) if (home.animal) animals?.retire(home.animal); });
  return { homes, ray: () => homes[0]?.animal ?? null, all: () => homes.flatMap((h) => h.animal ? [h.animal] : []) };
}
