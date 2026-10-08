import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { GOATS, apothem } from '../layout';
import { setHome } from './rig';

/** Rebuild the authored goat roster on its flat isle tops before strict retained restore, without a gameplay tick. */
export function spawnSkyGoats(animals: AnimalManager): AnimalManager['animals'] {
  return GOATS.map(g => {
    const animal = animals.spawn('skyGoat', g.isle.x + g.dx, g.isle.z + g.dz, 0, 'cloud', { y: g.isle.y });
    setHome(animal, { x: g.isle.x, z: g.isle.z, r: apothem(g.isle), y: g.isle.y });
    return animal;
  });
}
