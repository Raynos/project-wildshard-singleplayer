import * as v from 'valibot';
import { parseQuestData } from '@wildshard/sdk/quests';
import rows from './questRows.generated.json' with { type: 'json' };

/** Retained local POI and live anchor placement, alongside the public quest rows. */
const coordinate = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
const markerPlaces = v.record(v.string(), v.strictObject({
  poi: v.picklist(['world', 'hut', 'lookout', 'wreck', 'shrine', 'cave', 'pier']),
  x: coordinate, z: coordinate, y: v.exactOptional(coordinate), dy: v.exactOptional(coordinate),
  yaw: v.exactOptional(coordinate), anchor: v.exactOptional(v.pipe(v.string(), v.minLength(1), v.maxLength(256))),
}));
export const DRIFTWOOD_MARKERS = v.parse(markerPlaces, rows.markers);
export const DRIFTWOOD_QUESTS = parseQuestData(rows.quests);
const chapter = DRIFTWOOD_QUESTS.quests[0];
if (chapter === undefined) throw new Error('The declared Driftwood chapter is required');
export const DRIFTWOOD_QUEST = chapter;
