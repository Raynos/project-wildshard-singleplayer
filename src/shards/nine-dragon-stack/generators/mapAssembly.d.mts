import type { MapAssembly } from '../../../../scripts/map-geometry.mjs';

export function nineMapAssembly(): Promise<{ assembly: MapAssembly; facade: { id: string; count: number; poses: number }[] }>;

export function nineMapFiles(): Promise<Map<string, Uint8Array<ArrayBuffer>>>;
