import { jsonSlot } from '../saves/slots';

/** D227(b) (G872): Debug ▸ Loading & memory ▸ Release positions and index. 'on' lets the Memory saver also give up a
 *  static geometry's `position` (once its bounds are set) and its index after upload (memorySaver.ts); a reader brings
 *  either back from the GPU as before. Default off: a risky memory change ships behind this row until a Simulator /
 *  iPhone reading backs it (E451). Read once when the renderer starts: a reload row. */
export const FULL_RELEASE_SLOT = 'debug.memoryFullRelease';
let frozen: boolean | undefined;
export function fullReleaseOn(): boolean {
  frozen ??= jsonSlot(FULL_RELEASE_SLOT, 'device').read() === 'on';
  return frozen;
}
