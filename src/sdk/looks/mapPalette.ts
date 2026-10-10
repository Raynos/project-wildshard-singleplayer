import { mapPalette as platformMapPalette, type MapGroundLayer as PlatformMapGroundLayer, type MapMark as PlatformMapMark, type MapPaletteRow as PlatformMapPaletteRow, type MapRgb as PlatformMapRgb, type MapSegment as PlatformMapSegment, type MapStroke as PlatformMapStroke } from '@wildshard/game/systems/looks/mapPalette';

/** An sRGB colour, 0–255 per channel. */
export type MapRgb = PlatformMapRgb;
/** One layer of a map's ground paint: a colour mixed over the colour so far by a field's smoothstep. */
export type MapGroundLayer = PlatformMapGroundLayer;
/** One stroke of a segment or a trail: width (metres), CSS style, optional dash (metres). */
export type MapStroke = PlatformMapStroke;
/** A straight mark on the map, painted with each of its strokes in order. */
export type MapSegment = PlatformMapSegment;
/** A place's mark: a square, a turned box, a ring or a dot. */
export type MapMark = PlatformMapMark;
/** A level's whole map look as data (SHARD-PLATFORM M3). */
export type MapPaletteRow = PlatformMapPaletteRow;
/** A level's `minimap.palette` from its rows: the layered ground, the overlay's strokes and marks, the named places. */
export const mapPalette: typeof platformMapPalette = platformMapPalette;
