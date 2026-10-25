import type { MapBakeStamp } from './map-hash.mjs';
import type { MapRaster } from './map-painter.mjs';

/** SF88g: `output` paints one declared output. `sources` supplies owned terrain/props/scene rows and geometry/GLB bytes by logical input name; omitted inputs retain the declared file path checks. */
export function paintDataMap(root: string, slug: string, options?: { output?: string; glbs?: readonly string[]; sources?: ReadonlyMap<string, Uint8Array> }): Promise<{ raster: MapRaster; stamp: MapBakeStamp }>;
export function prepareDataMaps(root: string, only?: readonly string[]): Promise<void>;
/** Fresh local-phase verification shared only within one product build/report. */
export function createDataMapPreparation(root:string):(only?:readonly string[])=>Promise<void>;
