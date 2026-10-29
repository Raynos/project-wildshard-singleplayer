import {jsonSlot} from '../saves/slots';
import {isDev} from '../core/devMode';

let saved: ReturnType<typeof jsonSlot> | undefined;
function setting(): ReturnType<typeof jsonSlot> { return (saved ??= jsonSlot('debug.spawnRingReveal', 'device')); }
/** G867: reload-only readiness experiment. Public/default entry retains full coverage. */
export function spawnRingReveal(): boolean { return isDev() && setting().read() === true; }
/** The same Developer fence protects programmatic changes and saved picks. */
export function setSpawnRingReveal(value: boolean): void { if (isDev()) setting().write(value); }
