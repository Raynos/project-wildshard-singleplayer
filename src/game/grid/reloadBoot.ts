import type { SaveStore } from '@wildshard/engine/saves/store';
import { GridAssembly, type GridCell } from './assembly';
import { beginGridReload, completeGridReload, gridReloadSlot, validGridReload, type GridReloadHandoff } from './reloadHandoff';

/** Entry routing happens before the crash-rescue path, without loading the renderer or a runtime chunk. */
export type GridReloadBoot = { readonly kind: 'none' | 'invalid' } | { readonly kind: 'resume'; readonly value: GridReloadHandoff; readonly home: GridCell };
/** The first boot marks the attempt durably; a kill during admission cannot retry the same transfer. */
export function consumeGridReloadBoot(store: SaveStore, now: number): GridReloadBoot {
  const slot = gridReloadSlot(store);
  const status = slot.status?.();
  if (status === 'invalid' || status === 'future') { slot.read(); return { kind: 'invalid' }; }
  if (slot.read() === null) return { kind: 'none' };
  let assembly: GridAssembly | undefined;
  const value = beginGridReload(slot, (candidate) => {
    assembly = new GridAssembly(candidate.layout);
    // Content revision is verified from the authored manifest before hydration; no asset I/O happens here.
    return validGridReload(candidate, assembly, () => candidate.revision, now);
  });
  if (value === null || assembly === undefined) return { kind: 'invalid' };
  const home = assembly.at(0, 0);
  return home === undefined ? { kind: 'invalid' } : { kind: 'resume', value, home };
}

let planned: Extract<GridReloadBoot, { kind: 'resume' }> | null = null;
/** Only the composition root installs the attempted transfer; imports alone never change page routing. */
export function installPlannedGridReload(boot: GridReloadBoot): void { planned = boot.kind === 'resume' ? boot : null; }
/** The attempted transfer is shared by early residency, the live frame restore and the reveal gate. */
export function plannedGridReload(): Extract<GridReloadBoot, { kind: 'resume' }> | null { return planned; }
/** Called at fade-in after collision, ground and critical coverage are ready. */
export function finishPlannedGridReload(store: SaveStore): boolean {
  return planned !== null && completeGridReload(gridReloadSlot(store), planned.value);
}
