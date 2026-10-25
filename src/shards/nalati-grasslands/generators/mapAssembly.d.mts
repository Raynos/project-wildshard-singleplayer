import type { MapAssembly } from '../../../../scripts/map-geometry.mjs';
import type { BakedGrid } from '@wildshard/format/bakedTerrainBytes';

export function nalatiMapAssembly(): Promise<{ assembly: MapAssembly; native: BakedGrid }>;
export function readNalatiMapPlaces(directory?: string): unknown;
