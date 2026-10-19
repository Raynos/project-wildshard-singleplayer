import type { MapBakeStamp } from './map-hash.mjs';
import type { MapRaster } from './map-painter.mjs';

export function paintDataMap(root: string, slug: string): Promise<{ raster: MapRaster; stamp: MapBakeStamp }>;
export function prepareDataMaps(root: string, only?: readonly string[]): Promise<void>;
