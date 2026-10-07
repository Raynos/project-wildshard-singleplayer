import { app } from '@wildshard/engine/app/runtime';
import type { SaveStore } from '@wildshard/engine/saves/store';
import { GridAssembly } from './assembly';
import { devserverCellOn } from './debug';
import { gridMode } from './menu';
import { gridRecovery, recoveryCatalogue, type GridRecoveryRecord } from './recovery';

/** Page-local selection is installed explicitly by the composition root, never by importing this module. */
let selected: NonNullable<GridRecoveryRecord> | null = null;
let refused = false;

/** A validated current catalogue's default home and road lane, used when recovery metadata is unsafe. */
export function safeGridRecovery(assembly: GridAssembly, now: number): NonNullable<GridRecoveryRecord> {
  const home = assembly.at(0, 0);
  if (home === undefined) throw new Error('Recovery catalogue requires a home cell');
  return { instance: home.instance, slug: home.slug, catalogue: recoveryCatalogue(assembly), at: now, reason: 'gpu',
    road: { x: home.origin.x + assembly.pitch / 2 + 3.6, z: home.origin.z, yaw: 0 } };
}

/** Consume recovery metadata before routing/hydration; ordinary boot and unsupported future records select nothing. */
export function consumeGridRecovery(options: { assembly?: GridAssembly; saves?: SaveStore; now?: () => number } = {}): NonNullable<GridRecoveryRecord> | null {
  const assembly = options.assembly ?? new GridAssembly(gridMode(devserverCellOn()));
  const now = options.now ?? Date.now;
  const result = gridRecovery(options.saves ?? app.saves, now).consume(assembly);
  refused = result.kind === 'refused';
  selected = result.kind === 'resume' ? result.record : result.kind === 'fallback' ? safeGridRecovery(assembly, now()) : null;
  return selected;
}

/** Same-document handoff to ordinary admission and the live road placement; progress is read from real saves. */
export function pageGridRecovery(): NonNullable<GridRecoveryRecord> | null { return selected; }
/** A failed recovery boot returns to the title and must not supply a selection to another boot. */
export function clearGridRecovery(): void { selected = null; refused = false; }
/** Future or unconsumed metadata cannot enter a renderer on this boot. */
export function gridRecoveryRefused(): boolean { return refused; }
