import type { MapAssembly } from '../../../../scripts/map-assembly.mjs';

export function nineMapAssembly(): Promise<{ assembly: MapAssembly; facade: { id: string; count: number; poses: number }[] }>;
