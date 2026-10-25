import type { MapRaster } from '../src/sdk/bake/mapRaster';

export function mapRows(value: unknown, path?: readonly string[]): unknown[];
export function paintMapScenes(raster: MapRaster, config: unknown, settings: unknown, data: {
  /** Original owned GLB bytes, or a validated file path when no owned input was supplied. */
  input: (file: string) => string | Uint8Array;
  json: (file: string) => unknown;
  bytes: (file: string) => Uint8Array;
}): Promise<void>;
