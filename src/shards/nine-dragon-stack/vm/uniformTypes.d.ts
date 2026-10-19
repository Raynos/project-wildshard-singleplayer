import type { CanvasAtlasRow } from '@wildshard/sdk/looks/canvasAtlas';

export interface HeldView {
  readonly params: Readonly<Record<string, readonly string[]>>;
  readonly meshes: readonly { readonly name: string; readonly channels: Readonly<Record<string, string>>; readonly look: string; readonly maps: string; readonly hull: boolean; readonly doubleSide: boolean }[];
  readonly pendants: unknown;
  readonly materials: readonly string[];
  readonly decal: CanvasAtlasRow;
}
