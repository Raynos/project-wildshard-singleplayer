/** Named-place membership is authored once; runtime only selects placed copies. */
import layout from '../data/layout.generated.json' with { type: 'json' };

export const PINE_HOLLOW_QUEST_PLACES = [{ id: 'west-road', name: 'The west road', x: 30, z: -2, r: 16 }];
const declared = [
  { at: 'gate', place: 'pine-hollow/gate' }, { at: 'crossroads', place: 'pine-hollow/crossroads' },
  { at: 'cabin-1', place: 'pine-hollow/cabin-1' }, { at: 'cabin-2', place: 'pine-hollow/cabin-2' }, { at: 'cabin-3', place: 'pine-hollow/cabin-3' },
  { at: 'zipline', place: 'pine-hollow/zipline' }, { at: 'lookout', place: 'pine-hollow/lookout' }, { at: 'pond', place: 'pine-hollow/pond' },
  { at: 'waterfall', place: 'pine-hollow/waterfall' }, { at: 'islet', place: 'pine-hollow/islet' }, { at: 'dam', place: 'pine-hollow/dam' },
  { at: 'bridge', place: 'pine-hollow/bridge' }, { at: 'den', place: 'pine-hollow/den' }, { at: 'cave', place: 'pine-hollow/cave' },
  { at: 'clearing', place: 'pine-hollow/clearing' }, { at: 'lodge', place: 'pine-hollow/lodge' }, { at: 'mill', place: 'pine-hollow/mill' },
  { at: 'west-road', place: 'pine-hollow/west-road' },
];
const locations = new Map([...layout.PINE_HOLLOW_POIS, ...PINE_HOLLOW_QUEST_PLACES].map(row => [row.id, row]));
export const PLACE_SETS = declared.map(row => {
  const at = locations.get(row.at);
  if (at === undefined) throw new Error(`Missing named place: ${row.at}`);
  return { id: row.place, place: row.place, name: at.name, x: at.x, z: at.z, r: at.r };
});
