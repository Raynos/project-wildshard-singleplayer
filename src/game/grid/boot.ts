import { GridAssembly, type GridCell } from './assembly';
import { pageGridIntents } from './intent';
import { gridMode, type MenuMode } from './menu';
import { devserverCellOn } from './debug';
import { findShard } from '../shard/registry';
import { travel } from '../travel/travel';
import type { HomeResidencyClaim } from './pageResidency';
import { currentPageMode, setPageMode } from './pageMode';
/**
 * Infinite Wildshard's way in (SF21a). There is no assembled grid client yet (SF18a's residency, SF20a's in-page
 * crossing and SF18b's rings are not wired into a page), so the entry boots the furthest real thing: the grid catalogue's
 * home cell (0, 0) through the normal shard flow, as page mode `'grid'`. When the grid client lands, the grid page boots
 * it instead of the home cell's shard; the menu, the intent and the page mode stay.
 *
 *   title tap  → enterGrid()               the one-shot intent, then a fresh document for the home cell
 *   boot       → bootPageMode(slug)         consumes the intent; in grid mode the URL drops to the bare title URL, so any
 *                                           reload (or an iOS kill's restart) lands on the title
 *   alive beat → pageMode()                 AliveInfo.mode, so the title can say the grid ended unexpectedly
 */
export type PageMode = 'grid' | 'shard';

/** the home cell of the grid this device would assemble now (Developer, DEVSERVER and its Debug row apply at grid start) */
export function gridHome(mode?: MenuMode): GridCell {
  const assembly = new GridAssembly(gridMode(devserverCellOn(), mode));
  const home = assembly.at(0, 0);
  if (home === undefined) throw new Error('The grid catalogue has no home cell at (0, 0)');
  return home;
}

/** The title's Infinite Wildshard tap: write the one-shot intent, then open the home cell in a fresh document. */
export function enterGrid(): void {
  const home = gridHome();
  const target = findShard(home.slug);
  if (target === undefined) throw new Error(`The grid's home cell names no shard: ${home.slug}`);
  pageGridIntents().set({ instance: home.instance, slug: target.slug });
  travel({ to: target.slug, mode: 'enter' });
}

/** A grid cell by its stable catalogue instance id (SF14: `driftwood-isle`, `template-1` …; never the cell coordinates). */
export interface GridCellRef { readonly instance: string; readonly slug: string }
/**
 * The seam for inside-cell enter / leave notifications (SF46's hybrid runtime activation consumes them; the grid client
 * produces them). Today's home-cell boot enters its one cell at boot and never leaves it; the grid client calls
 * `enter` / `leave` as the player's frame crosses cell interiors. A late subscriber hears `enter` for the current cell.
 */
export class GridCellEvents {
  private current: GridCellRef | null = null;
  private readonly entered = new Set<(cell: GridCellRef) => void>();
  private readonly left = new Set<(cell: GridCellRef) => void>();
  /** the cell interior the player is in now (null on a strip, the highway, or outside the grid) */
  get cell(): GridCellRef | null { return this.current; }
  /** producer: the player entered a cell interior (leaving the previous one first) */
  enter(cell: GridCellRef): void {
    if (this.current?.instance === cell.instance) return;
    if (this.current !== null) this.leave();
    this.current = cell;
    for (const fn of this.entered) fn(cell);
  }
  /** producer: the player left the current cell interior */
  leave(): void {
    const was = this.current;
    if (was === null) return;
    this.current = null;
    for (const fn of this.left) fn(was);
  }
  /** consumer: returns the unsubscribe */
  onEnter(fn: (cell: GridCellRef) => void): () => void {
    this.entered.add(fn);
    if (this.current !== null) fn(this.current);
    return () => { this.entered.delete(fn); };
  }
  onLeave(fn: (cell: GridCellRef) => void): () => void { this.left.add(fn); return () => { this.left.delete(fn); }; }
}
/** this page's cell events (grid mode only ever enters cells) */
export const gridCells = new GridCellEvents();

/** The home cell's restored simulation as its client hands it over (sp-x5's `onSimulation`, SF15a): the existing driver's gate and its durable save. */
export interface GridHomeSimulation { readonly setActive: (active: boolean) => void; readonly checkpoint: () => boolean; readonly disposed: () => boolean; readonly residency?: HomeResidencyClaim; readonly suppressCheckpoint?: () => void }
/**
 * The seam between the home cell's client (its shardfile simulation, when one runs: Driftwood's hybrid boot) and the live
 * grid owner. The client offers its handoff once; the grid's live session takes it and gates the existing home driver
 * while the traveller is in another region (the freeze fence). A late taker hears the current offer.
 */
export class GridHomeHandoff {
  private current: GridHomeSimulation | null = null;
  private readonly takers = new Set<(sim: GridHomeSimulation) => void>();
  get simulation(): GridHomeSimulation | null { return this.current !== null && !this.current.disposed() ? this.current : null; }
  private expected = false;
  /** the home client announces a handoff on its way (a hybrid home in a grid page), so the entry reveal waits for it (G98) */
  expect(): void { this.expected = true; }
  /** true while an announced handoff has not arrived (the reveal's third wait; false when none was announced) */
  get pending(): boolean { return this.expected && this.current === null; }
  offer(sim: GridHomeSimulation): void { this.current = sim; for (const fn of this.takers) fn(sim); }
  take(fn: (sim: GridHomeSimulation) => void): () => void {
    this.takers.add(fn);
    const now = this.simulation; if (now !== null) fn(now);
    return () => { this.takers.delete(fn); };
  }
}
/** this page's home handoff (only a grid page's home client offers one) */
export const gridHomeSim = new GridHomeHandoff();

/** this page's mode, decided once at boot (held in the leaf grid/pageMode.ts) */
export function pageMode(): PageMode { return currentPageMode(); }

/** The boot's one read of the intent (every boot consumes it, used or not). In grid mode the address becomes the bare
 *  title URL (`history.replaceState`), so nothing but a new tap can bring the grid back. */
export function bootPageMode(slug: string): PageMode {
  let intent = null;
  try { intent = pageGridIntents().consume(slug); } catch { /* blocked storage: no intent, the normal shard flow */ }
  const mode: PageMode = intent === null ? 'shard' : 'grid';
  setPageMode(mode);
  if (intent !== null) gridCells.enter({ instance: intent.instance, slug: intent.slug }); // the home cell: the page starts inside it
  if (mode === 'grid' && typeof history !== 'undefined') {
    try { history.replaceState(history.state, '', new URL(location.pathname, location.origin)); } catch { /* a sandboxed frame: the URL stays */ }
  }
  return mode;
}

/** the catalogue instance this grid page booted into (null in shard mode) */
export function pageGridInstance(): string | null { return currentPageMode() === 'grid' ? gridCells.cell?.instance ?? null : null; }

/** The title page's boot: a stale intent is consumed and dropped, never kept for a later page. */
export function dropGridIntent(): void {
  try { pageGridIntents().consume(''); } catch { /* nothing to drop */ }
}
