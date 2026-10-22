import type { MapPaletteRow } from '@wildshard/format/minimap';

/** Offline scalar rasters and fixed metadata; no runtime recipe is carried. */
export interface GeographyRows {
  res: number; size: number; seed: number;
  spawn: { x: number; z: number; yaw: number };
  river: { level: number };
  channels: Record<'pond' | 'wet' | 'forest' | 'valley' | 'bowl' | 'snow' | 'red' | 'green' | 'blue' | 'gravel' | 'rock' | 'ice' | 'mapRed' | 'mapGreen' | 'mapBlue', string>;
  map: MapPaletteRow;
}
