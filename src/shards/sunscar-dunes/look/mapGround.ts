import { mapPalette } from '@wildshard/format/minimap';
import { SIGNAL_DUNES_MAP } from '../data/minimap';

/** The map palette's ground ramp (data/minimap.ts), for the tile bake's vertex colours: a generator imports only the
 *  authoring surface and its own shard's files. */
export const signalMapGround = mapPalette(SIGNAL_DUNES_MAP).ground;
