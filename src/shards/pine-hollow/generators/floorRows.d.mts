/** Build-only floor facts; the runtime independently validates its admitted JSON. */
export interface FloorPlacement { x: number; y: number; z: number; nx: number; ny: number; nz: number; rot: number; scale: number; r: number; g: number; b: number; matrix: number[] }
export type FloorLayout = Record<'ferns' | 'shrubs' | 'litter' | 'stones' | 'moss' | 'reeds', FloorPlacement[]>;
export function decodeFloorRecords(bytes: Uint8Array, expectedCounts: readonly number[]): FloorLayout;
