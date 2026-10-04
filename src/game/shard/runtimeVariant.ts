import type { ShardContext } from './context';

/** Register a reload-only runtime choice without importing the data loader or preparing trusted hooks. */
export function runtimeVariantEnabled(context: Pick<ShardContext, 'debugRow'>,
  row: Omit<Parameters<ShardContext['debugRow']>[0], 'change'>): boolean {
  let enabled = false;
  const adapters = context;
  adapters.debugRow({ ...row, change: (value) => { enabled = value === 'on'; } });
  return enabled;
}
