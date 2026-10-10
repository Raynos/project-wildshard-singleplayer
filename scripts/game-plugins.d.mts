/** A defining game module currently reached by primary trusted runtimes, directly or through SDK facades. */
export interface GamePluginModule { specifier: string; target: string | null; facades: string[]; shards: string[]; published: boolean }
/** Discover the migration's plugin surface without rebinding values or admitting a new module. */
export function gamePluginInventory(root?: string): GamePluginModule[];
