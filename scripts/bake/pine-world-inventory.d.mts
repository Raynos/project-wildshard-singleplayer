type Edges = Readonly<Record<'north' | 'east' | 'south' | 'west', readonly number[]>>;
/** Exact native payload hashes, distinct from the existing millimetre-rounded boundary declarations. */
export function pineTerrainWitness(bytes: Uint8Array, metadata: unknown, edges: Edges): {
  sha256: string; samples: number; resolution: number;
  boundaries: Record<string, { samples: number; sha256: string; declarationPrecisionMetres: number; maxRoundingError: number }>;
  entries: { side: string; bounds: number[]; area: number; y: number; nativeCorners: number }[];
};
/** Inventory of source inputs, without inferring residency from input wire sizes. */
export function inventoryPineWorld(root: string, edges: Edges): {
  terrain: ReturnType<typeof pineTerrainWitness>;
  sourceFiles: { path: string; bytes: number; sha256: string }[];
  assetInputs: { path: string; bytes: number; sha256: string }[];
  bakedInputs: { path: string; bytes: number; sha256: string }[];
  costs: { status: string; note: string };
};
