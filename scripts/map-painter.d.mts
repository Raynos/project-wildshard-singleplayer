import type { TerrainTileData } from '../src/format/terrainTileBytes';
import type { Matrix4 } from 'three';
import type { Node } from '@gltf-transform/core';

export function mapPixel(x: number, z: number, size?: number): number[];
export class MapRaster {
  constructor(size?: number, clip?: { clipBelow?: number; clipAbove?: number });
  size: number;
  height: Int32Array;
  colour: Uint8Array;
  triangles: number;
  triangle(points: readonly (readonly number[])[], colours: readonly (readonly number[])[]): void;
  terrain(tile: TerrainTileData): void;
  glb(file: string, placement?: Matrix4, select?: (node: Node) => boolean, options?: { local?: boolean }): Promise<void>;
}
export function stylizeMap(raster: MapRaster, style: { kind: string } & Record<string, unknown>): Buffer;
