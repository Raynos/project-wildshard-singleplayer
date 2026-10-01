import type * as BootMechanisms from './runtime';
/** Load browser mechanisms after the root selects its authored level. */
export function loadBootRuntime(): Promise<typeof BootMechanisms> { return import('./runtime'); }
export type BootRuntime = Awaited<ReturnType<typeof loadBootRuntime>>;
