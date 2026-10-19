import type { Matrix4 } from 'three';
import type { MapAssembly } from '../../../../scripts/map-assembly.mjs';

export function driftwoodMapAssembly(): Promise<{ assembly: MapAssembly; bridge: { planks: unknown[]; segments: unknown[] }; plan: { families: { indices: number[] }[]; used: number }; byProto: Map<string, Matrix4[]>; cover: number[]; entryDecks: { edge: string }[] }>;
