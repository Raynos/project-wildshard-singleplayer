import type { ShardContext } from './context';
import { currentPageMode } from '../grid/pageMode';

/** Register a reload-only runtime choice without importing the data loader or preparing trusted hooks. */
export function runtimeVariantEnabled(context: Pick<ShardContext, 'debugRow'>,
  row: Omit<Parameters<ShardContext['debugRow']>[0], 'change'>): boolean {
  let enabled = false;
  const adapters = context;
  adapters.debugRow({ ...row, change: (value) => { enabled = value === 'on'; } });
  return enabled;
}

/** Whether this page runs the grid (home or neighbour cell): a reload variant may default differently there (G180: Pine
 *  Hollow's memory trim is on by default in the grid). Read at build time, after the boot consumed the page's intent. */
export function gridPage(): boolean { return currentPageMode() === 'grid'; }
