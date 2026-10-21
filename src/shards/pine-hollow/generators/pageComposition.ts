import * as v from 'valibot';
import { QuestPageSchema } from '@wildshard/format/questPageComposition';
import { FOREST_STORY } from './forestStory';
import { PINE_QUEST_RUNTIME } from './questRuntime';
import { nameBlob } from '@wildshard/sdk/blobs';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { namedJsonSchema } from '@wildshard/sdk/formatJsonSchema';

/**
 * G565: Pine Hollow's quest page on the shared composition (game quest/pageComposition.ts): the forest story's rows as page
 * rows. The kit's table, its events and deaths, the lead's program and the talk steps come from the quest runtime section;
 * the board, shop, collections, mover, map and door are its optional facets; the lantern and mill-door pages bind over the
 * forest page, the ranged page's sounds, the token shelf and the barred door.
 */
const story = FOREST_STORY, cable = story.cable, at = ([x, y, z]: readonly [number, number, number]) => ({ x, y, z });
const before = ['hud.combat', 'main.frame'];
export const PINE_QUEST_PAGE = v.parse(QuestPageSchema, {
  id: 'pine.quest-page', debug: story.debug.id, placement: { registryReach: 20 },
  files: { services: story.files.services, stall: story.files.stall, contracts: story.files.contracts, director: story.files.director },
  kit: { section: story.content, registryReach: 20 },
  events: PINE_QUEST_RUNTIME.events, services: [],
  deaths: PINE_QUEST_RUNTIME.pageDeaths, deathOrder: 0, deathMoves: [],
  talks: { ...story.talks, steps: PINE_QUEST_RUNTIME.steps }, peopleLod: true,
  chapter: { program: PINE_QUEST_RUNTIME.lead.program },
  shop: true, board: { ...story.board, store: story.store, panel: story.panels.board },
  forest: story.page, ranged: story.ranged, placed: [{ owner: 'shelf', scene: story.shelf.scene }],
  // a collection's completion text belongs to its page action (the lantern page's 'all-resin' / 'all-tokens')
  collections: { panel: story.panels.count, rows: story.collections.map(({ event, completeEvent, prefix, names, label }) => ({ event, completeEvent, prefix, names, label })),
    pickup: { event: story.pickupEvent, sting: 'pickup' } },
  mover: { id: story.mover.id, target: 'canoe', mesh: story.mover.mesh, rest: story.mover.rest, binding: story.mover.binding, board: { sound: 'door', gain: 0.6 } },
  map: { publish: { declutter: true, unknownLabel: '?', markerLabels: 'full' }, zones: story.map.zones, features: { forest: story.page } },
  door: { forest: story.page, door: story.door.id, gates: { quest: PINE_QUEST_RUNTIME.leadPage.quest, gates: [
    { id: 'mill-door-bar', name: 'Mill door bar', opensWhen: { all: [story.door.flag] }, target: { kind: 'piece', piece: story.door.id } }] } },
  pages: [{ file: story.files.signals, prompts: story.signals.map(row => row.id) }, { file: story.files.door, requires: ['door'] }],
  points: story.signals,
  cable: { drawDistance: 160, view: { mode: cable.id, carriage: cable.trolley, scene: { kind: 'object', id: cable.scene }, prompt: at(cable.prompt),
    radius: cable.radius, label: cable.label, camera: true,
    feedback: { weapons: 'enabled', start: { sound: 'lever', at: at(cable.launch) }, end: { sound: 'plate', at: at(cable.landing) }, arrival: cable.arrival,
      shot: { audio: cable.audio, family: cable.shot, at: at(cable.top) } } } },
  places: story.map.pois.map(p => ({ id: p.id, label: p.name, x: p.x, z: p.z, r: p.r, quiet: true })),
  placeInterval: 0.5,
  systems: { kit: 'quest.kit', kitAfter: ['engine.compendium.installCompendium'], talks: 'quest', cable: 'quest.cable', places: 'quest.places', before },
});
/** the page's published rows (game shard install reads them as Driftwood's: quests/page-composition.json) */
export const PINE_QUEST_PAGE_BLOB = nameBlob('quests/page-composition.json', 'json', new TextEncoder().encode(encodeCanonicalJson(PINE_QUEST_PAGE)),
  { jsonSchema: namedJsonSchema(QuestPageSchema) });
