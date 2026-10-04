import { GridAssembly, type GridCell } from './assembly';
import { pageGridIntents } from './intent';
import { gridMode, type MenuMode } from './menu';
import { devserverCellOn } from './debug';
import { findShard } from '../shard/registry';
import { travel } from '../travel/travel';
/**
 * EXPERIMENTAL Wildshard's way in (SF21a). There is no assembled grid client yet (SF18a's residency, SF20a's in-page
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

/** The title's EXPERIMENTAL Wildshard tap: write the one-shot intent, then open the home cell in a fresh document. */
export function enterGrid(): void {
  const home = gridHome();
  const target = findShard(home.slug);
  if (target === undefined) throw new Error(`The grid's home cell names no shard: ${home.slug}`);
  pageGridIntents().set({ instance: home.instance, slug: target.slug });
  travel({ to: target.slug, mode: 'enter' });
}

let mode: PageMode = 'shard';
/** this page's mode, decided once at boot */
export function pageMode(): PageMode { return mode; }

/** The boot's one read of the intent (every boot consumes it, used or not). In grid mode the address becomes the bare
 *  title URL (`history.replaceState`), so nothing but a new tap can bring the grid back. */
export function bootPageMode(slug: string): PageMode {
  let intent = null;
  try { intent = pageGridIntents().consume(slug); } catch { /* blocked storage: no intent, the normal shard flow */ }
  mode = intent === null ? 'shard' : 'grid';
  if (mode === 'grid' && typeof history !== 'undefined') {
    try { history.replaceState(history.state, '', new URL(location.pathname, location.origin)); } catch { /* a sandboxed frame: the URL stays */ }
  }
  return mode;
}

/** The title page's boot: a stale intent is consumed and dropped, never kept for a later page. */
export function dropGridIntent(): void {
  try { pageGridIntents().consume(''); } catch { /* nothing to drop */ }
}
