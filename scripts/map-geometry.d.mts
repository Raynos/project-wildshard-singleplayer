import type { BufferGeometry, Matrix4 } from 'three';

export function readMapJson(file: string): unknown;
export function mapModel(file: string | Uint8Array, slot?: number, world?: boolean): Promise<BufferGeometry>;
export class MapAssembly {
  inventory: Record<string, number>;
  nodes: { id: string; name: string; geometry: string; matrices: number[]; instances: number }[];
  shapes: { name: string; geometry: BufferGeometry }[];
  add(name: string, geometry: BufferGeometry, matrices?: readonly Matrix4[]): void;
  encode(): { json: Uint8Array<ArrayBuffer>; binary: Uint8Array<ArrayBuffer> };
  write(file: string): void;
}
