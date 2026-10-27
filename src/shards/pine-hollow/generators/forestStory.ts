

import * as v from 'valibot';
import water from '../data/waterLook.json' with { type: 'json' };
import { contractCatalogue } from './contractRows';
import { WEAPON_FINISHES } from './weaponFinishes';
import { nameBlob , type NamedBlob as NamedBlobType } from '@wildshard/sdk/blobs';
import { yawWorld } from '@wildshard/engine/world/yawFrame';
import loadout from '../data/loadout.json' with { type: 'json' };
import policy from '../data/forestStory.json' with { type: 'json' };
import timbers from '../data/timberWorld.generated.json' with { type: 'json' };
import { pineQuestSites } from './bake-timber-scenes.mjs';
import { perSources, type PineSources } from './pineSources';
import { pineQuestNpcs } from './questNpcs';
import * as layout from './layout';
import sky from '../data/sky.json' with { type: 'json' };
import { BEATS, beatFlags, type Beat } from './questBeats';
import { QuestPageTalksSchema , type QuestPageTalksRows as QuestPageTalksRowsType } from '@wildshard/format/npcs';
import { ContractBoardPageSchema, parseContractBoardPage } from '@wildshard/format/contracts';
import { PINE_PANELS } from './panels';
import { namedJsonSchema } from '@wildshard/sdk/formatJsonSchema';

// GR8: called, not read from a scheduler job's output
const roster = pineQuestNpcs();

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
/** The forest story rows. */
export interface ForestStory { talks: QuestPageTalksRowsType; content: string; board: { at: { x: number; z: number; yaw: number; }; finishes: Record<string, string>; ammunition: { loadout: string; kind: string; }; height: number; radius: number; notices: { claimed: string; filled: string; progress: string; }; label: string; filled: string; }; door: { id: string; flag: string; }; signals: { id: string; x: number; z: number; height: number; }[]; cable: { id: string; scene: string; trolley: string; prompt: [number, number, number]; radius: number; label: string; top: [number, number, number]; launch: [number, number, number]; landing: [number, number, number]; arrival: string; audio: string; shot: string; }; mover: { id: string; mesh: string; binding: { systemId: string; bindings: { id: string; target: string; group: string; visibility: string; order: string; }[]; }; rest: string; }; secret: { mid: [number, number, number]; mouths: [number, number, number][]; scene: string; projection: string; x: number; z: number; yaw: number; floorY: number; floor: { x: number; z: number; hw: number; hd: number; y: number; rot: number; }; }; 
// the views' rows (game/quest/questPageViews): the journal-complete achievement; the dam sluice's flag lowers the pool
journal: { event: string; }; 
// the beaver pool: the dam sluice's flag lowers it (its look stands the surface over the bed, the declared creek's pool
// stretch follows its level, generators/bake-geography.mjs POOL_LEVEL), the dam's trickle fades in across the travel
pool: { name: string; flag: string; water: string; still: { scene: string; surface: { look: string; name: string; renderOrder: number; transition: { full: number; lowered: number; seconds: number; exponent: number; depth: string; film: number; lift: number; bank: number; reveal: number[]; }; }; }; trickle: { scene: string; surface: { look: string; name: string; renderOrder: number; }; }; level: { look: string; param: string; }; fade: { look: string; param: string; }; }; map: { pois: { id: string; name: string; x: number; z: number; r: number; foot: [number, number] | null; }[]; zones: { label: string; x: number; z: number; }[]; }; jumps: Record<string, { phase?: number; height?: { x: number; z: number; up: number; }; look: { x: number; z: number; }; flags: string[]; x: number; z: number; }>; page: string; ranged: string; quest: string; spawns: string; panels: { board: string; count: string; }; files: { stall: string; contracts: string; signals: string; door: string; services: string; director: string; }; store: { slot: string; state: string; }; pickupEvent: string; wheel: { flag: string; speed: number; }; debug: { id: string; browser: string; }; collections: { event: string; completeEvent: string; prefix: string; names: string[]; label: string; complete: string; }[]; shelf: { scene: string; collection: string; }; }
/** The forest story and its named blob. */
export interface ForestStoryRows { readonly FOREST_STORY: ForestStory; readonly FOREST_STORY_BLOB: NamedBlobType }
/** D65: the forest story over the program's sources (the hollow log's quest site), made once per sources. */
export const forestStory: (sources: PineSources) => ForestStoryRows = perSources((sources: PineSources): ForestStoryRows => {
  const sites = pineQuestSites(sources);
  const FOREST_STORY: ForestStory = {
    ...policy, talks: v.parse(QuestPageTalksSchema, policy.talks), content: 'custom/questRuntime',
    board: boardRows,
    door: { id: `cabin-${mill.index + 1}-door`, flag: policy.door.flag },
    signals: Object.entries(landmarks.waystoneSites).map(([id, at]) => ({ id, x: at.x, z: at.z, height: 1.2 })),
    cable: { id: 'pine.zipline', scene: 'quest-rides.root', trolley: 'quest-rides.trolley', prompt: triple([zip.launch[0], zip.launch[1] + 1.1, zip.launch[2]]),
      radius: 2.3, label: 'Ride the zipline', top: zip.top, launch: zip.launch, landing: zip.landing, arrival: 'Down the line and into the Hollow', audio: 'ambience', shot: 'zipline' },
    mover: { id: 'pine.canoe', mesh: 'quest-rides.canoe', binding: { systemId: 'pine.movers', bindings: [{ id: 'pine.canoe', target: 'canoe', group: 'group', visibility: 'enabled', order: 'XYZ' }] }, rest: 'heroes.canoe.root' },
    secret: { ...sites.hollow, mid: triple(sites.hollow.mid), mouths: sites.hollow.mouths.map(triple), scene: 'quests.hollow-log', projection: 'secret' },
    // the views' rows (game/quest/questPageViews): the journal-complete achievement; the dam sluice's flag lowers the pool
    journal: { event: 'journal' },
    // the beaver pool: the dam sluice's flag lowers it (its look stands the surface over the bed, the declared creek's pool
    // stretch follows its level, generators/bake-geography.mjs POOL_LEVEL), the dam's trickle fades in across the travel
    pool: { name: 'beaver-pool', flag: 'open:dam-sluice', water: 'pine-hollow.beaver-pool',
      still: { scene: 'pool.still', surface: water.surfaces.pool }, trickle: { scene: 'pool.trickle', surface: water.surfaces.trickle },
      level: { look: water.looks.pool, param: 'level' }, fade: { look: water.looks.trickle, param: 'fade' } },
    map: { pois: layout.PINE_HOLLOW_POIS, zones: layout.PINE_HOLLOW_ZONES.filter(zone => !placeNames.has(zone.label)) }, jumps,
  };
  const FOREST_STORY_BLOB: NamedBlobType = nameBlob('quests/forest-story.json', 'json', new TextEncoder().encode(JSON.stringify(FOREST_STORY)), { jsonSchema: namedJsonSchema(v.object({
    quest: v.literal(policy.quest), spawns: v.literal(policy.spawns),
    board: v.omit(ContractBoardPageSchema, ['contracts', 'panel', 'store']), store: ContractBoardPageSchema.entries.store, talks: QuestPageTalksSchema,
  })) });
  return { FOREST_STORY, FOREST_STORY_BLOB };
});
