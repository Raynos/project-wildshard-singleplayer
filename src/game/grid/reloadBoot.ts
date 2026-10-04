import type { SaveStore } from '@wildshard/engine/saves/store';
import { GridAssembly, type GridCell } from './assembly';
import { consumeGridReload, gridReloadSlot, validGridReload, type GridReloadHandoff } from './reloadHandoff';

/** Entry routing happens before the crash-rescue path, without loading the renderer or a runtime chunk. */
export type GridReloadBoot = { readonly kind: 'none' | 'invalid' } | { readonly kind: 'resume'; readonly value: GridReloadHandoff; readonly home: GridCell };
/** The first boot consumes the record durably. A kill during later admission cannot retry the same transfer. */
export function consumeGridReloadBoot(store: SaveStore, now: number): GridReloadBoot {
  const slot = gridReloadSlot(store);
  if (slot.read() === null) return { kind: 'none' };
  let assembly: GridAssembly | undefined;
  const value = consumeGridReload(slot, (candidate) => {
    assembly = new GridAssembly(candidate.layout);
    // Content revision is verified from the authored manifest before hydration; no asset I/O happens here.
    return validGridReload(candidate, assembly, () => candidate.revision, now);
  });
  if (value === null || assembly === undefined) return { kind: 'invalid' };
  const home = assembly.at(0, 0);
  return home === undefined ? { kind: 'invalid' } : { kind: 'resume', value, home };
}

let planned: Extract<GridReloadBoot, { kind: 'resume' }> | null = null;
/** Only the composition root installs the consumed transfer; imports alone never change page routing. */
export function installPlannedGridReload(boot: GridReloadBoot): void { planned = boot.kind === 'resume' ? boot : null; }
/** The already-consumed transfer is shared by early residency, the live frame restore and the reveal gate. */
export function plannedGridReload(): Extract<GridReloadBoot, { kind: 'resume' }> | null { return planned; }
