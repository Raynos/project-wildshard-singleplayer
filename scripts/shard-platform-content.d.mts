/** Structural content evidence, independent of behaviour compatibility and the 80/20 measure. */
export interface ShardContent {
  status: 'built' | 'missing' | 'invalid'; product: string; privateBinaries: string[];
  tiles: { total: number; l0: number; l1: number } | null;
  files: { total: number; kinds: Record<string, number> } | null;
  colliders: { descriptors: number; shapes: number; meshTiles: number; meshPanels: number; heightfield: boolean } | null;
  trustedSimulation: boolean | null; structuralWorld: boolean | null;
}
/** Count the emitted envelope and name private binaries; unavailable evidence stays explicitly unavailable. */
export function shardContent(slug: string, root: string, products?: string): ShardContent;
