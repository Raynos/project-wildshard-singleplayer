import * as v from 'valibot';
import { nameBlob } from '@wildshard/sdk/blobs';
import type { ForestStoryRows } from '@wildshard/sdk/quest/forestStoryRows';
import { yawWorld } from '@wildshard/engine/world/yawFrame';
import policy from '../data/forestStory.json' with { type: 'json' };
import packed from '../data/codeParts.json' with { type: 'json' };
import timbers from '../data/timberWorld.generated.json' with { type: 'json' };
import scenes from '../data/timberScenes.generated.json' with { type: 'json' };
import roster from '../data/questNpcs.generated.json' with { type: 'json' };
import layout from '../data/layout.generated.json' with { type: 'json' };
import sky from '../data/sky.json' with { type: 'json' };
import wardens from '../data/wardensHollow.json' with { type: 'json' };
import { BEATS, beatFlags, type Beat } from './questBeats';

const triple = (input: unknown): [number, number, number] => v.parse(v.tuple([v.number(), v.number(), v.number()]), input);
const landmarks = timbers.landmarks, board = landmarks.contractBoardSite;
const zip = { top: triple(landmarks.zip.top), bottom: triple(landmarks.zip.bottom), launch: triple(landmarks.zip.launch), landing: triple(landmarks.zip.landing) };
const tower = timbers.placements.lookout, ranger = roster.ranger;
const jumps = Object.fromEntries(Object.entries(BEATS).map(([id, beat]) => {
  const deck = yawWorld({ x: layout.LOOKOUT.x, z: layout.LOOKOUT.z, yaw: tower.yaw }, -1.2, -2.9);
  const at = beat.at === 'ranger' ? { x: ranger.at.x + 3.5 * ranger.cos, z: ranger.at.z - 3.5 * ranger.sin }
    : beat.at === 'deck' ? { x: deck[0], z: deck[1] } : beat.at === 'launch' ? { x: zip.launch[0], z: zip.launch[2] }
      : beat.at === 'lodge' ? { x: board.x - Math.sin(board.yaw) * 3, z: board.z - Math.cos(board.yaw) * 3 } : { x: beat.x, z: beat.z };
  const look = beat.at === 'ranger' ? ranger.at : beat.at === 'launch' ? { x: zip.bottom[0], z: zip.bottom[2] } : beat.at === 'lodge' ? board : beat.look;
  return [id, { ...at, look, flags: beatFlags(id as Beat),
    ...((beat.at === 'deck' || beat.at === 'launch') ? { height: { x: layout.LOOKOUT.x, z: layout.LOOKOUT.z, up: 11.05 } } : {}),
    ...(beat.night ? { phase: sky.phases.night } : beat.day ? { phase: sky.phases.day } : {}) }];
}));
export const FOREST_STORY: ForestStoryRows = {
  ...policy, content: 'custom/questRuntime', trades: { ...policy.trades, section: 'custom/tradeCatalogue' }, ammo: 'iron', parts: { url: packed.url, rows: packed.rows, label: 'chapter props' },
  board: { ...policy.board, at: board },
  signals: Object.entries(landmarks.waystoneSites).map(([id, at]) => ({ id, x: at.x, z: at.z, height: 1.2, lantern: { id: `waystone.${id}`, when: [`lit:${id}`, wardens.QUEST_DONE] } })),
  cable: { id: 'pine.zipline', geometry: packed.parts['zip-trolley'], prompt: [zip.launch[0], zip.launch[1] + 1.1, zip.launch[2]],
    radius: 2.3, label: 'Ride the zipline', top: zip.top, launch: zip.launch, landing: zip.landing, arrival: 'Down the line and into the Hollow' },
  mover: { id: 'pine.canoe', geometry: packed.parts.canoe, binding: { systemId: 'pine.movers', bindings: [{ id: 'pine.canoe', target: 'canoe', group: 'group', visibility: 'enabled', order: 'XYZ' }] }, rest: 'heroes.canoe.root' },
  secret: { ...scenes.sites.hollow, mid: triple(scenes.sites.hollow.mid), mouths: scenes.sites.hollow.mouths.map(triple), scene: 'quests.hollow-log', flag: 'secret:log', text: 'Inside the fallen giant. It smells of rain and old resin' },
  map: { pois: layout.PINE_HOLLOW_POIS, zones: layout.PINE_HOLLOW_ZONES }, jumps,
};
export const FOREST_STORY_BLOB = nameBlob('quests/forest-story.json', 'json', new TextEncoder().encode(JSON.stringify(FOREST_STORY)));
