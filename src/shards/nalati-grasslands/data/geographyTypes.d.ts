import type { MapPaletteRow } from '@wildshard/format/minimap';
import type { ScalarLatticeRows,ScalarTripletRows } from '@wildshard/format/scalarChannel';
import type { GroundRows } from '@wildshard/format/terrain';

/** Offline scalar rasters and fixed metadata; no runtime recipe is carried. */
export interface GeographyRows {
  res: number; size: number; seed: number;
  spawn: { x: number; z: number; yaw: number };
  river: { level: number };
  ground: GroundRows;
  channels: Record<'wet' | 'forest' | 'valley' | 'bowl' | 'snow' | 'mapRed' | 'mapGreen' | 'mapBlue', ScalarLatticeRows>;
  pigment: ScalarTripletRows;
  surface: ScalarTripletRows;
  map: MapPaletteRow;
}
