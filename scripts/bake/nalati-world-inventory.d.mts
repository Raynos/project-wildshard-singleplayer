type Edges = Record<'north' | 'east' | 'south' | 'west', { readonly heights: readonly number[] }>;
/** Exact native terrain identity, boundary hashes and continuous zero-height entry witnesses. */
export function nativeTerrainWitness(bytes: Uint8Array, edges: Edges): {
  resolution: number; samples: number; heightsSha256: string; sha256: string;
  boundaries: Record<string, { samples: number; sha256: string }>;
  entries: { side: string; bounds: number[]; y: number; area: number; nativeCorners: number }[];
};
/** Existing source and immutable asset identities; emitted costs are deliberately not inferred. */
export function inventoryNalatiWorld(root: string, edges: Edges): {
  terrain: ReturnType<typeof nativeTerrainWitness>;
  sourceFiles: { path: string; bytes: number; sha256: string }[];
  modelInputs: { path: string; bytes: number; sha256: string }[];
  textureInputs: { path: string; bytes: number; sha256: string }[];
  preserveTerrainAttributes: string[];
  costs: { status: string; note: string };
};
