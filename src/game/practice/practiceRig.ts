import type { AnimalFactory, AnimalModel } from '@wildshard/engine/entities/AnimalFactory';
import type { Rng } from '@wildshard/engine/core/rng';

/** Factory tint is a unit fraction, not an integer identity seed. Keep retries deterministic. */
export function instantiatePracticeRig(factory: Pick<AnimalFactory, 'instantiate'>, model: AnimalModel, rng: Pick<Rng, 'next'>): ReturnType<AnimalFactory['instantiate']> {
  return factory.instantiate(model, rng.next());
}
