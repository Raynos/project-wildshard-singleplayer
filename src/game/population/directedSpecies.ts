import { app } from '@wildshard/engine/app/runtime';
import type { SpeciesDef } from '@wildshard/engine/entities/species/registry';
import { ReturnProgram } from './returnProgram';
import { DirectedLaw } from './directedLaw';

/** Client-only projection of admitted guest motion over a native actor. The
 * director owns targets; ten-Hz guest decisions publish only state and motion.
 * Damage is a synchronous event projection over the existing hit owner. The
 * law is DirectedLaw (renderer-free, CI12); the page pages the entry's program
 * on the level scope at each call, as before. */
export class DirectedSpecies {
  readonly binding: Pick<SpeciesDef, 'think' | 'damageMul'>;
  constructor(recipe: unknown, input: unknown) {
    this.binding = new DirectedLaw(recipe, () => ReturnProgram.page(input, app.levelScope ?? undefined)).binding;
  }
}
