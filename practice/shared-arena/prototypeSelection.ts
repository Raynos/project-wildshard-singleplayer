import type { PracticePrototypeSelection } from '../../src/game/practice/PracticePrototypeAnimal';

/** WIP ownership is explicit and never substitutes for a requested native corpse. */
export function validatePrototypeSelectionKeys(ids: readonly string[], selection: Readonly<Record<string, PracticePrototypeSelection>> | undefined, native: boolean): void {
  if (selection === undefined) return;
  const keys = Object.keys(selection);
  if (native || keys.length !== 1 || keys.some(key => !ids.includes(key)))
    throw new Error('Prototype product requires one exact opponent and no native-corpse selection');
}
