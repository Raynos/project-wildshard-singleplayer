import type { CoveGeometry } from './cove';

/** Explicit Node producer over the cold native ground and retained AO table. */
export declare function originalCove(): { geometry: CoveGeometry['geometry']; metadata: unknown };
