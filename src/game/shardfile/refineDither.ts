/**
 * MF13 slice 2 (stream past spawn invisibly): a fine tile that refines in play fades its pieces in with a screen-door
 * dither (engine render/nodes/partFade.ts) over REFINE_FADE_MS, and the coarse cover under it leaves only once it has.
 * A risky rendering change (AGENTS: default off until a physical-device reading): Settings ▸ Debug ▸ Refine dither
 * (Developer), Off by default; a pick reloads, as the refine materials are marked before their first compile.
 *
 *   refineDither()            // the tile driver and the refine library, at their construction
 *   installRefineDitherRow()  // the world's scenes, once a page (idempotent)
 */
import { authoredRows } from '@wildshard/engine/ui/authoredDebugRows';
import { jsonSlot } from '@wildshard/engine/saves/slots';
import { isDev } from '@wildshard/engine/core/devMode';
import { GAME_STRINGS } from '../strings';

/** how long a refined tile's pieces take to dither in (ms) */
export const REFINE_FADE_MS = 500;
const ON = 'on', OFF = 'off';
let slot: ReturnType<typeof jsonSlot> | null = null;
const store = (): ReturnType<typeof jsonSlot> => (slot ??= jsonSlot('debug.global.refineDither', 'device'));
function saved(): string {
  try { return store().read() === ON ? ON : OFF; } catch { return OFF; }
}

/** Whether refined tiles dither in (a Developer's pick; off otherwise). */
export function refineDither(): boolean { return isDev() && saved() === ON; }

let installed = false;
/** Register the row once a page; it lives as long as the page. */
export function installRefineDitherRow(): void {
  if (installed) return;
  installed = true;
  const text = GAME_STRINGS.refineDither;
  authoredRows.add({ purpose: 'developer', id: 'refineDither', group: 'tools', label: text.label, note: text.note, ask: 'E435', reviewBy: '2026-11-12', reload: true,
    choices: () => [{ v: OFF, text: text.off }, { v: ON, text: text.on }], get: () => (isDev() ? saved() : OFF),
    set: (next) => { if (isDev() && (next === ON || next === OFF)) store().write(next); },
    on: () => undefined, when: () => true });
}
