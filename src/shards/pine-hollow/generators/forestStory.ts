import * as v from 'valibot';
import { contractCatalogue } from './contractRows';
import { WEAPON_FINISHES } from './weaponFinishes';
import { nameBlob } from '@wildshard/sdk/blobs';
import type { ForestStoryRows } from '@wildshard/sdk/quest/forestStoryRows';
import { yawWorld } from '@wildshard/engine/world/yawFrame';
import loadout from '../data/loadout.json' with { type: 'json' };
import policy from '../data/forestStory.json' with { type: 'json' };
import timbers from '../data/timberWorld.generated.json' with { type: 'json' };
import scenes from '../data/timberScenes.generated.json' with { type: 'json' };
import roster from '../data/questNpcs.generated.json' with { type: 'json' };
import layout from '../data/layout.generated.json' with { type: 'json' };
import sky from '../data/sky.json' with { type: 'json' };
import { BEATS, beatFlags, type Beat } from './questBeats';
import { QuestPageTalksSchema } from '@wildshard/format/npcs';
import { ContractBoardPageSchema, parseContractBoardPage } from '@wildshard/format/contracts';
import { PINE_PANELS } from './panels';
import { namedJsonSchema } from '@wildshard/sdk/formatJsonSchema';

const triple = (input: unknown): [number, number, number] => v.parse(v.tuple([v.number(), v.number(), v.number()]), input);
const landmarks = timbers.landmarks, board = landmarks.contractBoardSite;
const mill = timbers.cabins.buildings.find(row => row.id === policy.door.building);
if (mill === undefined) throw new Error('Missing declared quest building');
const placeNames = new Set(layout.PINE_HOLLOW_POIS.map(row => row.name.toUpperCase()));
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
const finishes: Readonly<Record<string, { readonly name: string; readonly weapon: string; readonly blurb: string }>> = WEAPON_FINISHES;
const contracts = contractCatalogue();
const finishToasts = Object.fromEntries([...new Set([...contracts.rows.flatMap(row => row.reward.skin === undefined ? [] : [row.reward.skin]), ...contracts.milestones.map(row => row.skin)])].map(id => {
  const row = finishes[id]; if (row === undefined) throw new Error('Missing board finish');
  return [id, `${row.name} ${row.weapon} finish — ${row.blurb}`];
}));
const boardRows = { ...policy.board, at: board, finishes: finishToasts, ammunition: { loadout: loadout.persistence.state, kind: 'iron' } };
parseContractBoardPage({ contracts, panel: PINE_PANELS.board, store: policy.store, ...boardRows });
export const FOREST_STORY: ForestStoryRows = {
  ...policy, talks: v.parse(QuestPageTalksSchema, policy.talks), content: 'custom/questRuntime',
  board: boardRows,
  door: { id: `cabin-${mill.index + 1}-door`, flag: policy.door.flag },
  signals: Object.entries(landmarks.waystoneSites).map(([id, at]) => ({ id, x: at.x, z: at.z, height: 1.2 })),
  cable: { id: 'pine.zipline', scene: 'quest-rides.root', trolley: 'quest-rides.trolley', prompt: [zip.launch[0], zip.launch[1] + 1.1, zip.launch[2]],
    radius: 2.3, label: 'Ride the zipline', top: zip.top, launch: zip.launch, landing: zip.landing, arrival: 'Down the line and into the Hollow', audio: 'ambience', shot: 'zipline' },
  mover: { id: 'pine.canoe', mesh: 'quest-rides.canoe', binding: { systemId: 'pine.movers', bindings: [{ id: 'pine.canoe', target: 'canoe', group: 'group', visibility: 'enabled', order: 'XYZ' }] }, rest: 'heroes.canoe.root' },
  secret: { ...scenes.sites.hollow, mid: triple(scenes.sites.hollow.mid), mouths: scenes.sites.hollow.mouths.map(triple), scene: 'quests.hollow-log' },
  map: { pois: layout.PINE_HOLLOW_POIS, zones: layout.PINE_HOLLOW_ZONES.filter(zone => !placeNames.has(zone.label)) }, jumps,
};
export const FOREST_STORY_BLOB = nameBlob('quests/forest-story.json', 'json', new TextEncoder().encode(JSON.stringify(FOREST_STORY)), { jsonSchema: namedJsonSchema(v.object({
  board: v.omit(ContractBoardPageSchema, ['contracts', 'panel', 'store']), store: ContractBoardPageSchema.entries.store, talks: QuestPageTalksSchema,
})) });
