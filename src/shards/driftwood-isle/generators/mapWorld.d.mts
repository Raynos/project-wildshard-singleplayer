import type { BufferGeometry, Matrix4 } from 'three';
import type { MapAssembly } from '@wildshard/sdk/bake/mapAssembly';

export function mapJson(bytes: Uint8Array): unknown;
export function mapModel(bytes: Uint8Array, slot?: number, world?: boolean): Promise<BufferGeometry>;
export class MapWorld {
  constructor(assembly: MapAssembly, section: unknown, catalogue: unknown, blobs: readonly { readonly file: { readonly name: string; readonly kind?: string }; readonly bytes: Uint8Array }[]);
  recipe(step: unknown, root?: Matrix4, omitted?: readonly string[]): Promise<void>;
  placement(row: unknown): Promise<void>;
  dispose(): void;
}
export function mapPool(bytes: Uint8Array, world?: boolean): Promise<Map<string, BufferGeometry>>;
