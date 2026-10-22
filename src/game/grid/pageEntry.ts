import { saves } from '@wildshard/engine/saves/runtime';
import type { SaveStore } from '@wildshard/engine/saves/store';
import { GridAssembly, type GridCell } from './assembly';
import { pageGridIntents } from './intent';
import { DEVSERVER, gridMode, type MenuMode } from './menu';
import { gridRecovery, recoveryCatalogue, type GridRecoveryRecord } from './recovery';
import { setPageMode } from './pageMode';
import { gridCells, type PageMode } from '../plugin/context';
import { findShard } from '../shard/registry';
import { chooseShardEntry } from '../shard/entryMode';
import { travel } from '../travel/travel';

// P0 (Jake's phone, tap -> loader): the page entry routes on these before anything else, so this module stays off
// three.js and the game graph (src/entry.ts imports it first; plugin/ui's 3.2 MB closure evaluated in that task).
/**
 * Infinite Wildshard's way in (SF21a). The catalogue's home cell boots through the normal shard flow as page mode
 * `'grid'`; its live grid session borrows that world and transfers the traveller between admitted frames. A title tap
 * or a validated recovery record selects the home before normal memory admission and descriptor hydration.
 *
 *   title tap  → enterGrid()               the one-shot intent, then a fresh document for the home cell
 *   boot       → bootPageMode(slug)         consumes the tap or uses validated recovery; the URL drops to the bare title
 *                                           URL, so an unrecorded reload (or an iOS kill's restart) lands on the title
 *   alive beat → pageMode()                 AliveInfo.mode, so the title can say the grid ended unexpectedly
 */


/** the home cell of the grid this device would assemble now (Developer and DEVSERVER apply at grid start) */
export function gridHome(mode?: MenuMode): GridCell {
  const assembly = new GridAssembly(gridMode(DEVSERVER, mode));
  const home = assembly.at(0, 0);
  if (home === undefined) throw new Error('The grid catalogue has no home cell at (0, 0)');
  return home;
}

/** The title's Infinite Wildshard tap: write the one-shot intent, then open the home cell in a fresh document. */
export function enterGrid(): void {
  // A deliberate new player attempt starts a new guard window; automatic reloads cannot clear it.
  if (!gridRecovery(saves).clearLoop()) throw new Error('Grid recovery guard could not be cleared');
  clearGridRecovery();
  const home = gridHome();
  const target = findShard(home.slug);
  if (target === undefined) throw new Error(`The grid's home cell names no shard: ${home.slug}`);
  // INFINITE WILDSHARD enters the catalogue home, never SHARD SELECT's frozen LEGACY copy.
  chooseShardEntry(target.slug, 'shardfile');
  pageGridIntents().set({ instance: home.instance, slug: target.slug });
  travel({ to: target.slug, mode: 'enter' });
}


/** The boot's one read of the tap intent (used or not), overridden by validated recovery before ordinary admission.
 * In grid mode the address becomes the bare title URL, preventing an unrecorded automatic restart. */
export function bootPageMode(slug: string): PageMode {
  let intent = null;
  try { intent = pageGridIntents().consume(slug); } catch { /* blocked storage: no intent, the normal shard flow */ }
  const recovery = pageGridRecovery();
  if (recovery !== null && [slug].includes(recovery.slug)) intent = { instance: recovery.instance, slug: recovery.slug, at: recovery.at };
  const mode: PageMode = intent === null ? 'shard' : 'grid';
  setPageMode(mode);
  if (intent !== null) gridCells.enter({ instance: intent.instance, slug: intent.slug }); // the home cell: the page starts inside it
  if (mode === 'grid' && typeof history !== 'undefined') {
    try { history.replaceState(history.state, '', new URL(location.pathname, location.origin)); } catch { /* a sandboxed frame: the URL stays */ }
  }
  return mode;
}


/** The title page's boot: a stale intent is consumed and dropped, never kept for a later page. */
export function dropGridIntent(): void {
  try { pageGridIntents().consume(''); } catch { /* nothing to drop */ }
}

/** Page-local selection is installed explicitly by the composition root, never by importing this module. */
let selected: NonNullable<GridRecoveryRecord> | null = null;
let refused = false;
let loop = false;

/** A validated current catalogue's default home and road lane, used when recovery metadata is unsafe. */
export function safeGridRecovery(assembly: GridAssembly, now: number): NonNullable<GridRecoveryRecord> {
  const home = assembly.at(0, 0);
  if (home === undefined) throw new Error('Recovery catalogue requires a home cell');
  return { instance: home.instance, slug: home.slug, catalogue: recoveryCatalogue(assembly), at: now, reason: 'gpu',
    road: { x: home.origin.x + assembly.pitch / 2 + 3.6, z: home.origin.z, yaw: 0 } };
}

/** Consume recovery metadata before routing/hydration; ordinary boot and unsupported future records select nothing. */
export function consumeGridRecovery(options: { assembly?: GridAssembly; saves?: SaveStore; now?: () => number; unexpected?: boolean } = {}): NonNullable<GridRecoveryRecord> | null {
  const assembly = options.assembly ?? new GridAssembly(gridMode(DEVSERVER));
  const now = options.now ?? Date.now;
  const result = gridRecovery(options.saves ?? saves, now).consume(assembly, options.unexpected);
  loop = result.kind === 'loop';
  refused = result.kind === 'refused' || loop;
  selected = result.kind === 'resume' ? result.record : result.kind === 'fallback' ? safeGridRecovery(assembly, now()) : null;
  return selected;
}

/** Same-document handoff to ordinary admission and the live road placement; progress is read from real saves. */
export function pageGridRecovery(): NonNullable<GridRecoveryRecord> | null { return selected; }
/** A failed recovery boot returns to the title and must not supply a selection to another boot. */
export function clearGridRecovery(): void { selected = null; refused = false; loop = false; }
/** Future or unconsumed metadata cannot enter a renderer on this boot. */
export function gridRecoveryRefused(): boolean { return refused; }
/** A repeated failing recovery opens the existing shard picker, never another automatic boot. */
export function gridRecoveryLoop(): boolean { return loop; }
