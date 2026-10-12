import { gridFloorDocumentIdentity } from './frame-floor-grid.mjs';

/** @param {unknown} value */
function documentToken(value) {
  if (value === null || typeof value !== 'object' || !('token' in value)
    || typeof value.token !== 'string' || value.token.length === 0)
    throw new Error('Missing title-navigation document identity');
  return value.token;
}

/** Hand off the one intentional title navigation before any floor sample.
 * Submit the tap once through a synchronous protocol command. An asynchronous
 * result envelope cannot survive navigation. All later samples keep their fence.
 * @param {{ evaluate(expression:string):Promise<unknown>, tapGrid():Promise<unknown>, followed():Promise<unknown> }} driver */
export async function handoffFloorGridNavigation(driver) {
  const identity = `(${gridFloorDocumentIdentity.toString()})()`;
  const before = documentToken(await driver.evaluate(identity));
  await driver.tapGrid();
  await driver.followed();
  const after = documentToken(await driver.evaluate(identity));
  if (before === after)
    throw new Error('The grid tap did not hand off to a new document');
}

/** Submit the same title-button tap before its existing delayed navigation. */
export const FLOOR_GRID_TAP = `(() => {
  const button = document.querySelector('.ws-main-grid');
  if (!button) throw new Error('The title grid button disappeared before the tap');
  setTimeout(() => button.click(), 100);
  return true;
})()`;
