/** Touch controls own absolute pointer positions and capture; desktop lock would invalidate that input contract. */
export function gameplayPointerLock(nolock: boolean, touchActive: boolean): boolean {
  return !nolock && !touchActive;
}
