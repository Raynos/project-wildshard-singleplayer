import type { BufferGeometry } from 'three';

export function mapBinary(file: string, shuffled?: boolean): Uint8Array;
export function mapGeometry(bytes: Uint8Array, offset: number, row: unknown): BufferGeometry;
