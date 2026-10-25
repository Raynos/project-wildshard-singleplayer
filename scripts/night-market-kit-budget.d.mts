export interface KitTileCost {
  compressed: number; resident: number; triangles: number; draws: number;
}
/** Read only a verified final Night Market product. No build, source fallback or live-memory estimate. */
export function readNightMarketKitBudget(folder: string): {
  product: string; indexHash: string; basis: string;
  rm8Targets: { l0Triangles: number; l0Compressed: number; reportOnly: boolean };
  rows: (KitTileCost & { lod: 0 | 1; x: number; z: number; rm8Target: boolean | null })[];
  uniqueTileFiles: number; uniqueTileClosure: KitTileCost; existingCapDebt: Record<string, number>;
};
