/** The grass rows as their readers parse them (admission schemas downstream), and the owned blocks they name. */
export interface NalatiGrassRows { readonly sources: readonly { readonly name: string; readonly kind: 'bin'; readonly source: string; readonly options: { readonly decoded: number } }[]; readonly [key: string]: unknown }
export interface NalatiGrass { readonly rows: NalatiGrassRows; readonly files: ReadonlyMap<string, Uint8Array> }
export function nalatiGrassBake(terrain: Uint8Array, placements: ReadonlyMap<string, Uint8Array>): NalatiGrass;
