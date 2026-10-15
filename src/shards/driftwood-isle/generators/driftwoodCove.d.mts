import type { CoveGeometry } from './cove';
import type { cascadeGeometry } from './cascade';

/** Explicit Node producer over the cold native ground and retained AO table. */
export declare function originalCove(): { geometry: CoveGeometry['geometry']; fall: ReturnType<typeof cascadeGeometry>; metadata: unknown };
