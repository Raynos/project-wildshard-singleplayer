import { jsonSlot } from '../saves/slots';

let saved: ReturnType<typeof jsonSlot> | undefined;
function setting(): ReturnType<typeof jsonSlot> { return (saved ??= jsonSlot('debug.drawBudget', 'device')); }
/** FC (G924): the phone's draw budget, read once when the level's tier rows resolve. Current (default) is today's rows;
 *  Lean lays the level's own grid-cell rows (`tiers.grid`) over them in a standalone world too: nearer tree, shadow and
 *  animal bands, fewer draws a frame. Debug ▸ Look ▸ Draw budget, for Jake's phone pick. */
export function leanDrawBudget(): boolean { return setting().read() === 'lean'; }
export function setLeanDrawBudget(lean: boolean): void { setting().write(lean ? 'lean' : 'current'); }
