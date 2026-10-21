import type { MapBakeStamp } from './map-hash.mjs';
import type { MapRaster } from './map-painter.mjs';

/** SF88g: `output` paints one declared output of the folder from its own `glbs`. */
export function paintDataMap(root: string, slug: string, options?: { output?: string; glbs?: readonly string[] }): Promise<{ raster: MapRaster; stamp: MapBakeStamp }>;
export function prepareDataMaps(root: string, only?: readonly string[]): Promise<void>;
