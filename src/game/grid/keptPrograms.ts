import type { Scope } from '@wildshard/engine/app/scope';
import { isDev } from '@wildshard/engine/core/devMode';
import { jsonSlot } from '@wildshard/engine/saves/slots';
import { authoredRows } from '@wildshard/engine/ui/authoredDebugRows';
import type { DebugRow } from '@wildshard/engine/ui/debugOptions';
import { GAME_STRINGS } from '../strings';

export const SHADER_WARM_PICK = 'debug.gridShaderWarm';
/** G580 T2: off; keep a retiring cell's compiled programs for the next cell; also, while the traveller waits at a cell's
 *  wall, let live Safari preparation issue more programs a frame (engine/render/precompile setWarmUpHeld); also freeze the
 *  parked destination's matrices during its warm-up (setParkedMatricesFrozen). Each choice includes the ones before. */
export type ShaderWarmChoice = 'off' | 'keep' | 'held' | 'frozen';

/** The Developer choice (default off under the risky render / memory rule until a device reading). */
export function readShaderWarmChoice(): ShaderWarmChoice {
  if (!isDev()) return 'off';
  const value = jsonSlot(SHADER_WARM_PICK, 'device').read();
  return value === 'keep' || value === 'held' || value === 'frozen' ? value : 'off';
}

/** The Developer row; the session reads its choice once and keeps it until a reload. */
export function installShaderWarmChoice(scope: Scope): ShaderWarmChoice {
  const saved = jsonSlot(SHADER_WARM_PICK, 'device'), listeners = new Set<() => void>();
  const active = readShaderWarmChoice(), text = GAME_STRINGS.grid.shaderWarm;
  const row: DebugRow = { id: 'gridShaderWarm', group: 'loading', label: text.label,
    choices: () => [{ v: 'off', text: text.off }, { v: 'keep', text: text.keep }, { v: 'held', text: text.held }, { v: 'frozen', text: text.frozen }],
    get: () => readShaderWarmChoice(), set: value => {
      if (!isDev() || value !== 'off' && value !== 'keep' && value !== 'held' && value !== 'frozen') return;
      saved.write(value); for (const listener of listeners) listener();
    }, on: listener => { listeners.add(listener); }, reload: true, when: () => isDev(),
    ask: 'E435', reviewBy: '2026-12-30', note: text.note };
  authoredRows.add(row);
  scope.onDispose(() => { authoredRows.delete(row); listeners.clear(); });
  return active;
}
