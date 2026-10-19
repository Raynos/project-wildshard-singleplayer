import type { MapAssembly } from '../../../../scripts/map-assembly.mjs';
import type { BakedGrid } from '@wildshard/format/bakedTerrainBytes';

export function nalatiMapAssembly(): Promise<{ assembly: MapAssembly; native: BakedGrid }>;
