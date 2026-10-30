import { jsonSlot } from '../saves/slots';
import { isDev } from '../core/devMode';

let saved: ReturnType<typeof jsonSlot> | undefined;
function setting(): ReturnType<typeof jsonSlot> { return (saved ??= jsonSlot('debug.graphBatches', 'device')); }
/** PF1 (G936): a graph (node) look on a non-facade batched draw (`place`'s batched rows, the forest) batches as a classic
 *  look does, one multi-draw batch per material, as legacy drew the same trees. Debug ▸ Performance ▸ Graph batches:
 *  Batched (default) or Instanced, the per-geometry path E271 / E272 routed every graph look to, kept as a fallback until
 *  the phone QA (the row reloads). A facade never batches either way. */
export function graphBatches(): boolean { return !(isDev() && setting().read() === 'instanced'); }
/** The same Developer fence protects programmatic changes and saved picks. */
export function setGraphBatches(batched: boolean): void { if (isDev()) setting().write(batched ? 'batched' : 'instanced'); }
