import type { BufferGeometry } from 'three';

export const MODEL_NAMES: readonly string[];
export const MODEL_FILES: readonly string[];
export function cloneFrame(name: string, geometry: BufferGeometry): BufferGeometry | null;
export function bakeModelPaint(bytes: Uint8Array, name: string): Promise<Uint8Array>;
