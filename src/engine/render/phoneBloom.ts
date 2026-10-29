import { jsonSlot } from '../saves/slots';

let saved: ReturnType<typeof jsonSlot> | undefined;
function setting(): ReturnType<typeof jsonSlot> { return (saved ??= jsonSlot('debug.phoneBloom', 'device')); }
/** FC10 (G910): the phone frame's bloom, read once when the composer is built. Off by default: its mip chain was most of
 *  the phone's render-target switches (art/frame-cost/round-4-fc10-bloom); On is the old look, Debug ▸ Look ▸ Phone bloom. */
export function phoneBloom(): boolean { return setting().read() === true; }
export function setPhoneBloom(value: boolean): void { setting().write(value); }
