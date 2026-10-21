import type { PracticeNativeSelection } from '../../src/game/practice/PracticeNativeActor';

/** Composition only, never admission: one exact selected owner per already-admitted product.
 * No default native owner, wildcard, unknown species or empty opt-in is accepted. */
export function validateNativeSelectionKeys(ids: readonly string[], selection: Readonly<Record<string, PracticeNativeSelection>> | undefined): void {
  if (selection === undefined) return;
  const keys = Object.keys(selection);
  if (keys.length !== 1 || keys.some(key => !ids.includes(key)))
    throw new Error('Arena native product requires one exact admitted opponent');
}
