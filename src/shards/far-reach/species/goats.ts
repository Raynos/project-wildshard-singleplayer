import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { SKY_SPAWNS } from '../data/spawns';
import { GOATS, apothem } from '../layout';
import { setHome } from './rig';

/** Rebuild the authored goat roster on its flat isle tops before strict retained restore, without a gameplay tick. */
export function spawnSkyGoats(animals: AnimalManager, spawn?: (index: number, y: number) => AnimalManager['animals'][number] | null): AnimalManager['animals'] {
  return GOATS.map((g, index) => {
    const row = SKY_SPAWNS.actors.find(actor => actor.id === `far.goat.${String(index)}`);
    if (row === undefined) throw new Error('Missing declared Sky goat');
    const animal = spawn === undefined ? animals.spawn(row.kind, row.at[0], row.at[1], row.yaw, row.look, { y: g.isle.y }) : spawn(index, g.isle.y);
    if (animal === null) throw new Error('Missing runtime Sky goat');
    setHome(animal, { x: g.isle.x, z: g.isle.z, r: apothem(g.isle), y: g.isle.y });
    return animal;
  });
}
