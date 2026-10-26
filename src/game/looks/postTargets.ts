/**
 * G713's comparison (core-memory C5): the engine composer's render targets as today (A, the default) or variant B's
 * lighter chain (engine render/lighterTargets.ts: an 8-bit output buffer after the tone map, bloom from a quarter-size
 * luminance, the god rays' light mask at half size, FXAA in place of SMAA), picked in one Settings ▸ Debug row. The
 * composer is built once a level, so the row reloads. Jake's pick deletes this module, the row and the losing side.
 */
import { authoredRows } from '@wildshard/engine/ui/authoredDebugRows';
import type { DebugRow } from '@wildshard/engine/ui/debugOptions';
import type { DebugRowSpec } from '@wildshard/engine/level/context';
import { jsonSlot } from '@wildshard/engine/saves/slots';
import { GAME_STRINGS } from '../strings';

const ROW_ID = 'postTargets';
type PostTargets = 'today' | 'lighter';
let installed = false;

/** A game-wide reload row over a device save (the shape of a shard's `ctx.debugRow` spec); returns the saved pick. */
function globalRow(spec: Omit<DebugRowSpec, 'reload' | 'change'>): string {
  const slot = jsonSlot(`debug.global.${spec.id}`, 'device'), listeners = new Set<() => void>();
  const read = (): string => { try { const value = slot.read(); return typeof value === 'string' && spec.choices.some((choice) => choice.value === value) ? value : spec.initial; } catch { return spec.initial; } };
  const row: DebugRow = { id: spec.id, group: spec.group, label: spec.label, note: spec.note, ask: spec.ask, reviewBy: spec.reviewBy, reload: true,
    choices: () => spec.choices.map((choice) => ({ v: choice.value, text: choice.text })), get: read,
    set: (next) => { if (!spec.choices.some((choice) => choice.value === next)) return; slot.write(next); for (const fn of listeners) fn(); },
    on: (fn) => { listeners.add(fn); }, when: () => true };
  authoredRows.add(row);
  return read();
}
const rows = { debugRow: globalRow };

/** The row (once a page) and the render-target chain this load builds. */
export function postTargetsPick(): PostTargets {
  const text = GAME_STRINGS.postTargets;
  const pick = installed ? jsonSlot(`debug.global.${ROW_ID}`, 'device').read() : rows.debugRow({
    id: 'postTargets', group: 'look', label: text.label, note: text.note, ask: 'E435', reviewBy: '2026-12-30',
    choices: [{ value: 'today', text: text.today }, { value: 'lighter', text: text.lighter }], initial: 'today',
  });
  installed = true;
  return pick === 'lighter' ? 'lighter' : 'today';
}
