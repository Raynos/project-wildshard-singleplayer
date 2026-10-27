/** Node authors supply the exact repository-relative terrain/scalar reads; returned placement bytes are caller-owned. */
export function nativeNalatiDressingPlacements(read: (name: string) => Uint8Array, geography?: ReadonlyMap<string, Uint8Array>): Promise<ReadonlyMap<string, Uint8Array>>;
