import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { SKY_FLOCK_GROUPS } from '../data/spawns';
import { setHome } from './rig';

/** Rebuild the authored goat roster on its flat isle tops before strict retained restore, without a gameplay tick. */
export function spawnSkyGoats(animals: AnimalManager): AnimalManager['animals'] {
  return SKY_FLOCK_GROUPS.goats.map(row => {
    const animal = animals.spawn(row.kind, row.at[0], row.at[1], row.yaw, row.look, { y: row.home.y });
    setHome(animal, row.home);
    return animal;
  });
}
