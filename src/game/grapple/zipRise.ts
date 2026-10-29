/**
 * QB17 (b) / MF15 (Jake 10-29: "the zip button doesn't zip me up to the top of the hook … it doesn't lift me up into the
 * sky"; G872): a hook zip rises to the ring first (the hook point, the capsule hanging under it), hangs a beat, then flies
 * down onto the landing the search found. One Developer row, Settings ▸ Debug ▸ Hook zip, keeps the flat zip LEGACY and
 * the port always flew (straight to the landing beside the ring) beside it until Jake picks; the loser goes with the row.
 *
 *   installZipRiseRow()   // a grapple's install, once a page (idempotent)
 *   zipRises()            // the sim, at each fire
 */
import { authoredRows } from '@wildshard/engine/ui/authoredDebugRows';
import { jsonSlot } from '@wildshard/engine/saves/slots';
import { isDev } from '@wildshard/engine/core/devMode';
import { GAME_STRINGS } from '../strings';

const RISE = 'rise', FLAT = 'flat';
let slot: ReturnType<typeof jsonSlot> | null = null;
const store = (): ReturnType<typeof jsonSlot> => (slot ??= jsonSlot('debug.global.hookZip', 'device'));
function saved(): string {
  try { return store().read() === FLAT ? FLAT : RISE; } catch { return RISE; }
}

/** Whether a hook zip rises to the ring first (the default); the flat zip only on a Developer's pick. */
export function zipRises(): boolean { return !isDev() || saved() !== FLAT; }

let installed = false;
/** Register the row once a page; it lives as long as the page. */
export function installZipRiseRow(): void {
  if (installed) return;
  installed = true;
  const text = GAME_STRINGS.hookZip;
  authoredRows.add({ purpose: 'developer', id: 'hookZip', group: 'tools', label: text.label, note: text.note, ask: 'E435', reviewBy: '2026-11-12', reload: false,
    choices: () => [{ v: RISE, text: text.rise }, { v: FLAT, text: text.flat }], get: () => (isDev() ? saved() : RISE),
    set: (next) => { if (isDev() && (next === RISE || next === FLAT)) store().write(next); },
    on: () => undefined, when: () => true });
}
