import type * as Meadow from './world/meadow';
/** Runtime meadow services load after pure manifest discovery. */
export function loadMeadow(): Promise<typeof Meadow> { return import('./world/meadow'); }
