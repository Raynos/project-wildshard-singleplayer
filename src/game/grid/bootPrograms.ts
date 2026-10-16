import type { Scope } from '@wildshard/engine/app/scope';
import { isDev } from '@wildshard/engine/core/devMode';
import { jsonSlot } from '@wildshard/engine/saves/slots';
import { authoredRows } from '@wildshard/engine/ui/authoredDebugRows';
import type { DebugRow } from '@wildshard/engine/ui/debugOptions';
import { GAME_STRINGS } from '../strings';
import { selectedBootCell } from './bootProgramSelection';

export const BOOT_PROGRAM_PICK = 'debug.gridBootPrograms';
interface CellChoice { readonly instance: string; readonly label: string }

/** One reload-only comparison. The active selection is frozen before any temporary world is constructed. */
export function installBootProgramChoice(scope: Scope, cells: readonly CellChoice[]): string | null {
  const saved = jsonSlot(BOOT_PROGRAM_PICK, 'device'), listeners = new Set<() => void>();
  const read = (): string | null => selectedBootCell(cells, saved.read(), isDev());
  const active = read(), text = GAME_STRINGS.grid.loadingPrograms;
  const row: DebugRow = { id: 'gridBootPrograms', group: 'loading', label: text.label,
    choices: () => [{ v: 'off', text: text.off }, ...cells.map(cell => ({ v: cell.instance, text: cell.label }))],
    get: () => read() ?? 'off', set: value => {
      if (!isDev() || value !== 'off' && !cells.some(cell => cell.instance === value)) return;
      saved.write(value); for (const listener of listeners) listener();
    }, on: listener => { listeners.add(listener); }, reload: true, when: () => isDev(),
    ask: 'E435', reviewBy: '2026-12-30', note: text.note };
  authoredRows.add(row);
  scope.onDispose(() => { authoredRows.delete(row); listeners.clear(); });
  return active;
}
