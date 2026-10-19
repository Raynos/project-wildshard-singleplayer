import type { MapRaster } from './map-painter.mjs';

export function mapRows(value: unknown, path?: readonly string[]): unknown[];
export function paintMapScenes(raster: MapRaster, config: unknown, settings: unknown, data: {
  input: (file: string) => string;
  json: (file: string) => unknown;
  bytes: (file: string) => Uint8Array;
}): Promise<void>;
