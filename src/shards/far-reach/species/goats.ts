import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { SKY_FLOCK_GROUPS } from '../data/spawns';
import { setHome } from './rig';

/** Rebuild the authored goat roster on its flat isle tops before strict retained restore, without a gameplay tick. */
export function spawnSkyGoats(animals: AnimalManager, spawn?: (index: number, y: number) => AnimalManager['animals'][number] | null): AnimalManager['animals'] {
  return SKY_FLOCK_GROUPS.goats.map((row, index) => {
    const animal = spawn === undefined ? animals.spawn(row.kind, row.at[0], row.at[1], row.yaw, row.look, { y: row.home.y }) : spawn(index, row.home.y);
    if (animal === null) throw new Error('Missing runtime Sky goat');
    setHome(animal, row.home);
    return animal;
  });
}
