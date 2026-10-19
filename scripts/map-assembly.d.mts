import type { BufferGeometry, Matrix4 } from 'three';

export function readMapJson(file: string): unknown;
export function mapBinary(file: string, shuffled?: boolean): Uint8Array;
export function mapGeometry(bytes: Uint8Array, offset: number, row: unknown): BufferGeometry;
export function mapModel(file: string, slot?: number, world?: boolean): Promise<BufferGeometry>;
export class MapAssembly {
  inventory: Record<string, number>;
  nodes: { id: string; name: string; geometry: string; matrices: number[]; instances: number }[];
  shapes: { name: string; geometry: BufferGeometry }[];
  add(name: string, geometry: BufferGeometry, matrices?: readonly Matrix4[]): void;
  write(file: string): void;
}
