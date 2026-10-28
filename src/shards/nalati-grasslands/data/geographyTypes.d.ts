import type { AuthorMapPalette as MapPaletteRow } from '@wildshard/sdk/bake/mapRaster';
import type { authorFormatRows } from '@wildshard/sdk/formatJsonSchema';

type GroundRows = ReturnType<typeof authorFormatRows<'terrain.GroundRowsSchema'>>;
type ScalarLatticeRows = ReturnType<typeof authorFormatRows<'scalarChannel.ScalarLatticeSchema'>>;
type ScalarTripletRows = ReturnType<typeof authorFormatRows<'scalarChannel.ScalarTripletSchema'>>;

/** Offline scalar rasters and fixed metadata; no runtime recipe is carried. */
export interface GeographyRows {
  sources:{name:string;kind:'bin';source:string;options:{decoded:number}}[];
  res: number; size: number; seed: number;
  spawn: { x: number; z: number; yaw: number };
  river: { level: number };
  ground: GroundRows;
  channels: Record<'wet' | 'forest' | 'mapRed' | 'mapGreen' | 'mapBlue', ScalarLatticeRows>;
  pigment: ScalarTripletRows;
  surface: ScalarTripletRows;
  map: MapPaletteRow;
}
