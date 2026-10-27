import type { BufferGeometry, Matrix4 } from 'three';
import type { MapAssembly } from '@wildshard/sdk/bake/mapAssembly';

export function mapPose(pose: unknown): Matrix4;
export class MapWorld {
  constructor(assembly: MapAssembly, section: unknown, catalogue: unknown, blobs: readonly { readonly file: { readonly name: string; readonly kind?: string }; readonly bytes: Uint8Array }[]);
  recipe(step: unknown, root?: Matrix4, omitted?: readonly string[]): Promise<void>;
  placement(row: unknown): Promise<void>;
  batch(row: unknown): Promise<void>;
  weld(graph: unknown): Promise<void>;
  dispose(): void;
}
export function mapGround(source: { heightAt: (x: number, z: number) => number; splatAt: (x: number, z: number) => readonly number[] }, resolution: number, size: number, palette: readonly (readonly number[])[], hole?: (points: number[][]) => boolean): BufferGeometry;
export function mapPool(bytes: Uint8Array, world?: boolean): Promise<Map<string, BufferGeometry>>;
