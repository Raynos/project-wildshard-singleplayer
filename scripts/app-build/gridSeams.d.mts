export interface GridAssetAddress { readonly url: string; readonly bytes: number; readonly sha256: string }
export interface GridSeamAsset { readonly fileName: string; readonly source: string; readonly files?: readonly GridAssetAddress[];
  readonly address: GridAssetAddress & { readonly geometry?: { readonly directory: GridAssetAddress; readonly homes: readonly string[] } } }
/** The baked seams' path under the repo root (gitignored). */
export const GRID_SEAMS: string;
/** Keep the certifier's exact JSON bytes; only its small address enters JavaScript. */
export function gridSeamAsset(source: string): GridSeamAsset;
/** Bake and certify the grid seams into GRID_SEAMS. */
export function bakeGridSeams(root: string): void;
/** The baked seams' asset (throws when the app build has not baked them). */
export function readGridSeams(root: string): GridSeamAsset;
/** Write the baked seams' exact bytes as their hashed asset into `outDir`. */
export function writeGridSeams(outDir: string, root: string): void;
