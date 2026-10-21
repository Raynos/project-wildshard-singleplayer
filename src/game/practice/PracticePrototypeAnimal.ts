import { Animal } from '@wildshard/engine/entities/AnimalView';

/** Explicit WIP contract: real combat with immediate despawn, not native corpse admission. */
export interface PracticePrototypeSelection {
  readonly death: 'despawn';
}

/** Keeps the normal living model, attacks and damage pipeline. No physical corpse is requested. */
export class PracticePrototypeAnimal extends Animal {
  protected override died(): void {
    this.hidden = true;
    this.mesh.visible = false;
    this.retireBody();
  }
}

/** Reject mixed lifecycle owners rather than silently weakening native admission. */
export function validatePracticePrototype(prototype: PracticePrototypeSelection | undefined, native: boolean): void {
  if (prototype === undefined) return;
  if (native) throw new Error('Prototype despawn and native corpse ownership cannot be combined');
}
