import type { MapAssembly } from '../../../../scripts/map-assembly.mjs';

export function pineMapAssembly(): Promise<{ assembly: MapAssembly; trees: { x: number; y: number; z: number; r: number; variant: number }[]; floor: { layout: Record<string, { matrix: number[] }[]> } }>;
